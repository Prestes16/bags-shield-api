/**
 * POST /api/launchpad/create-config
 *
 * Creates a Bags fee-share configuration for Launch v2. The creator/payer
 * must be explicitly included and the BPS total must be exactly 10000.
 */

import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import {
  getOrGenerateRequestId,
  safeJsonParse,
  checkRateLimitByIp,
  checkIdempotencyKey,
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
  SafeLogger,
} from "@/lib/security";
import { handlePreflight } from "@/lib/security/cors";
import {
  bagsFeeShareConfigRequestSchema,
  validateLaunchpadInput,
} from "@/lib/launchpad/schemas";
import {
  createFeeShareConfig,
  type BagsFeeShareConfigResponse,
  type BagsFeeShareConfigRequest,
  type BagsResult,
} from "@/lib/launchpad/bags-client";
import {
  BAGS_SHIELD_FEE_SHARE_WALLET,
  buildLaunchpadFeeShare,
} from "@/lib/launchpad/fees";
import { getLaunchpadMode, isLaunchpadEnabled } from "@/lib/env";
import { consolidateSetupTransactions } from "@/lib/launchpad/consolidate-setup";
import { getHeliusRpcUrl } from "@/lib/helius";
import {
  isLaunchpadPublicWritesPaused,
  LAUNCHPAD_SAFE_MODE_PAUSED_CODE,
  LAUNCHPAD_SAFE_MODE_PAUSED_MESSAGE,
} from "@/lib/launchpad/safety";

const PARTNER_CONFIG_ENV = "LAUNCHPAD_PARTNER_CONFIG";
const PARTNER_MODE_ENV = "LAUNCHPAD_PARTNER_MODE_ENABLED";

/**
 * Returns the server-side partner config PDA from env, validated as a Solana
 * public key. Returns null if the env var is absent, empty, or invalid.
 * Client-supplied `partnerConfig` is NEVER used — always overwritten server-side.
 */
function getServerPartnerConfig(): string | null {
  const raw = process.env[PARTNER_CONFIG_ENV]?.trim();
  if (!raw) return null;
  try {
    return new PublicKey(raw).toBase58();
  } catch {
    return null;
  }
}

/**
 * Bags partner mechanism is opt-in. By default Bags Shield collects its fee
 * share as an explicit fee CLAIMER (treasury in claimersArray), which is the
 * documented v2 model and requires no on-chain partner config. The optional
 * partner/partnerConfig path is only used when explicitly enabled AND a valid
 * partner config PDA is configured — attaching a non-existent partner config
 * makes Bags `/fee-share/config` fail with a 500.
 */
function isPartnerModeEnabled(): boolean {
  const value = process.env[PARTNER_MODE_ENV]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

const ROUTE = "/api/launchpad/create-config";

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ["POST"]);
}

function jsonResponse(req: NextRequest, requestId: string, body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set("X-Request-Id", requestId);
  return res;
}

function pickConfigKey(response: Record<string, unknown>) {
  const configKey = response.configKey;
  if (typeof configKey === "string" && configKey.trim()) return configKey;

  const meteoraConfigKey = response.meteoraConfigKey;
  if (typeof meteoraConfigKey === "string" && meteoraConfigKey.trim()) return meteoraConfigKey;

  return undefined;
}

function getUpstreamStatus(details?: Record<string, unknown>) {
  const status = details?.status;
  return typeof status === "number" ? status : undefined;
}

function getUpstreamString(details: Record<string, unknown> | undefined, key: string) {
  const value = details?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getBpsTotal(config: BagsFeeShareConfigRequest) {
  return config.basisPointsArray.reduce((total, bps) => total + bps, 0);
}

function summarizeAttempt(
  name: string,
  config: BagsFeeShareConfigRequest,
  result: BagsResult<BagsFeeShareConfigResponse>,
) {
  if (!("error" in result)) {
    return {
      name,
      success: true,
      sentKeys: Object.keys(config),
      claimersCount: config.claimersArray.length,
      basisPointsCount: config.basisPointsArray.length,
      totalBps: getBpsTotal(config),
      hasPartner: Boolean(config.partner),
      hasPartnerConfig: Boolean(config.partnerConfig),
    };
  }

  return {
    name,
    success: false,
    sentKeys: Object.keys(config),
    claimersCount: config.claimersArray.length,
    basisPointsCount: config.basisPointsArray.length,
    totalBps: getBpsTotal(config),
    hasPartner: Boolean(config.partner),
    hasPartnerConfig: Boolean(config.partnerConfig),
    errorCode: result.error.code,
    upstreamStatus: getUpstreamStatus(result.error.details),
    upstreamCode: getUpstreamString(result.error.details, "upstreamCode"),
    upstreamMessage: getUpstreamString(result.error.details, "upstreamMessage") || result.error.message,
    rawResponseHint: getUpstreamString(result.error.details, "rawResponseHint"),
  };
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = getOrGenerateRequestId(req.headers);

  if (!isLaunchpadEnabled()) {
    SafeLogger.warn("Launchpad create-config called while disabled", { requestId, endpoint: ROUTE });
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "FEATURE_DISABLED", message: "Launchpad feature is not enabled" },
        meta: { requestId },
      },
      { status: 503 },
    );
  }

  if (getLaunchpadMode() !== "real") {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: "LAUNCHPAD_REAL_MODE_REQUIRED",
          message: "Launchpad Bags integration is not enabled in real mode",
        },
        meta: { requestId },
      },
      { status: 503 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimitCheck = checkRateLimitByIp(ip, ROUTE);
  if (!rateLimitCheck.allowed) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded" },
        meta: { requestId },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": "20",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rateLimitCheck.resetAt),
        },
      },
    );
  }

  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const idempotencyCheck = checkIdempotencyKey(idempotencyKey, ROUTE);
    if (idempotencyCheck && !idempotencyCheck.allowed) {
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "IDEMPOTENCY_KEY_CONFLICT",
            message: "Request with this idempotency key already processed",
          },
          meta: { requestId },
        },
        { status: 409 },
      );
    }
  }

  if (isLaunchpadPublicWritesPaused()) {
    SafeLogger.warn("Launchpad create-config blocked by server-side Safety Gate", {
      requestId,
      endpoint: ROUTE,
    });
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: LAUNCHPAD_SAFE_MODE_PAUSED_CODE,
          message: LAUNCHPAD_SAFE_MODE_PAUSED_MESSAGE,
        },
        meta: { requestId, elapsedMs: Date.now() - startTime, publicWritesEnabled: false },
      },
      { status: 423 },
    );
  }

  const contentType = req.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json" },
        issues: [{ path: "headers.content-type", message: "Expected application/json" }],
        meta: { requestId },
      },
      { status: 415 },
    );
  }

  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch (error) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "BAD_REQUEST", message: "Failed to read request body" },
        issues: [{ path: "<root>", message: error instanceof Error ? error.message : "Unknown error" }],
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  const parseResult = safeJsonParse<unknown>(bodyText);
  if (!parseResult.success) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "BAD_REQUEST", message: parseResult.error || "Invalid JSON" },
        issues: parseResult.issues || [],
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  const validation = validateLaunchpadInput(bagsFeeShareConfigRequestSchema, parseResult.data);
  if (!validation.ok) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "VALIDATION_FAILED", message: "Request validation failed" },
        issues: "issues" in validation ? validation.issues : [],
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  try {
    const input = ("data" in validation ? validation.data : {}) as BagsFeeShareConfigRequest;

    // Partner mechanism is opt-in. Default flow collects the Bags Shield fee via
    // the fee CLAIMER (treasury in claimersArray) and omits partner/partnerConfig
    // entirely, which avoids the upstream 500 caused by referencing a partner
    // config PDA that has not been created on-chain.
    const serverPartnerConfig = getServerPartnerConfig();
    const partnerModeEnabled = isPartnerModeEnabled() && Boolean(serverPartnerConfig);

    let feeShare: ReturnType<typeof buildLaunchpadFeeShare>;
    try {
      feeShare = buildLaunchpadFeeShare(input.payer);
    } catch (error) {
      SafeLogger.error("Launchpad fee-share configuration unavailable", error, {
        requestId,
        endpoint: ROUTE,
      });
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "FEE_CONFIGURATION_UNAVAILABLE",
            message: error instanceof Error ? error.message : "Launchpad fee-share configuration is unavailable",
          },
          meta: { requestId, elapsedMs: Date.now() - startTime },
        },
        { status: 503 },
      );
    }

    const config: BagsFeeShareConfigRequest = {
      payer: input.payer,
      baseMint: input.baseMint,
      claimersArray: feeShare.claimersArray,
      basisPointsArray: feeShare.basisPointsArray,
      // Partner mechanism is opt-in only. Client-supplied partner/partnerConfig
      // are never used — values come from server env when partner mode is on.
      ...(partnerModeEnabled
        ? { partner: BAGS_SHIELD_FEE_SHARE_WALLET, partnerConfig: serverPartnerConfig as string }
        : {}),
      ...(input.bagsConfigType ? { bagsConfigType: input.bagsConfigType } : {}),
      ...(input.additionalLookupTables ? { additionalLookupTables: input.additionalLookupTables } : {}),
    };

    const configAttempt = partnerModeEnabled ? "partner_config" : "fee_claimer";
    const bagsResult = await createFeeShareConfig(config);
    const attempts: Array<ReturnType<typeof summarizeAttempt>> = [
      summarizeAttempt(configAttempt, config, bagsResult),
    ];

    if ("error" in bagsResult) {
      const upstreamStatus = getUpstreamStatus(bagsResult.error.details);
      const upstreamCode = getUpstreamString(bagsResult.error.details, "upstreamCode");
      const upstreamMessage = getUpstreamString(bagsResult.error.details, "upstreamMessage");
      const rawResponseHint = getUpstreamString(bagsResult.error.details, "rawResponseHint");
      SafeLogger.error("Bags fee-share config request failed", undefined, {
        requestId,
        endpoint: ROUTE,
        errorCode: bagsResult.error.code,
        upstreamStatus,
        upstreamCode,
        attemptCount: attempts.length,
        finalAttempt: configAttempt,
        payloadKeys: Object.keys(config),
        claimersCount: feeShare.claimersArray.length,
        basisPointsCount: feeShare.basisPointsArray.length,
        totalBps: feeShare.totalBps,
        hasPartner: partnerModeEnabled,
        hasPartnerConfig: partnerModeEnabled,
      });

      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "BAGS_CREATE_CONFIG_FAILED",
            message: partnerModeEnabled
              ? "Bags create-config (fee-share with partner) request failed"
              : "Bags create-config (fee-share) request failed",
            upstreamStatus,
            upstreamCode,
            upstreamMessage: upstreamMessage || bagsResult.error.message,
            rawResponseHint,
            attempts,
            canRequestSignature: false,
            canContinueToLaunch: false,
          },
          response: {
            publicFlowSafe: false,
            canRequestSignature: false,
            canContinueToLaunch: false,
          },
          meta: {
            requestId,
            upstream: "bags",
            upstreamStatus,
            configAttempt,
            partnerConfigFallbackUsed: false,
            elapsedMs: Date.now() - startTime,
          },
        },
        {
          status: bagsResult.error.code === "BAGS_NOT_CONFIGURED"
            ? 503
            : upstreamStatus === 400 || upstreamStatus === 422
              ? upstreamStatus
              : 502,
        },
      );
    }

    const upstreamResponse = bagsResult.response as Record<string, unknown>;
    const configKey = pickConfigKey(upstreamResponse);
    const directFeeShareSetupTransactions = Array.isArray(upstreamResponse.feeShareSetupTransactions)
      ? upstreamResponse.feeShareSetupTransactions
      : [];
    const transactions = Array.isArray(upstreamResponse.transactions) ? upstreamResponse.transactions : [];
    const bundles = Array.isArray(upstreamResponse.bundles) ? upstreamResponse.bundles : [];
    const hasDirectFeeShareSetupTransactions = directFeeShareSetupTransactions.length > 0;
    const hasTransactions = transactions.length > 0;
    const hasBundles = bundles.length > 0;

    // ── Consolidacao mobile/APK ─────────────────────────────────────────────
    // O cliente mobile aceita no maximo 1 assinatura de setup. Quando a Bags
    // retorna 2+ setup txs (payer-only, nao assinadas), fundimos as instrucoes
    // em UMA VersionedTransaction v0 com blockhash fresco. Se a consolidacao
    // for impossivel (assinatura parcial, signer extra, tamanho, LUT), mantemos
    // o array original (desktop continua funcionando) e expomos o motivo em
    // setupConsolidation para o cliente decidir.
    let finalTransactions = transactions;
    let finalDirectSetup = directFeeShareSetupTransactions;
    let setupConsolidation: Record<string, unknown> | null = null;
    // Bags pode devolver as setup txs em dois formatos: `transactions`
    // (objetos {transaction}) ou `feeShareSetupTransactions` (strings).
    // Consolidamos ambos os formatos.
    const consolidationCandidates: Array<{ transaction?: string }> | null =
      bundles.length > 0
        ? null
        : directFeeShareSetupTransactions.length > 1
          ? (directFeeShareSetupTransactions as unknown[]).map((t) =>
              typeof t === "string" ? { transaction: t } : (t as { transaction?: string }),
            )
          : transactions.length > 1
            ? (transactions as Array<{ transaction?: string }>)
            : null;
    if (consolidationCandidates) {
      const rpcUrl = (process.env.SOLANA_RPC_URL || "").trim() || getHeliusRpcUrl();
      const merged = await consolidateSetupTransactions(
        consolidationCandidates,
        input.payer,
        rpcUrl,
      );
      if (merged.ok) {
        finalTransactions = [
          { transaction: merged.transaction, encoding: merged.encoding, blockhash: merged.blockhash },
        ];
        finalDirectSetup = [];
        setupConsolidation = {
          attempted: true,
          ok: true,
          mergedCount: merged.mergedCount,
          sourceShape: directFeeShareSetupTransactions.length > 1 ? "feeShareSetupTransactions" : "transactions",
        };
        SafeLogger.info("Fee-share setup transactions consolidated for mobile", {
          requestId,
          endpoint: ROUTE,
          mergedCount: merged.mergedCount,
        });
      } else {
        const failureCode = "code" in merged ? String(merged.code) : "UNKNOWN";
        setupConsolidation = { attempted: true, ok: false, code: failureCode };
        SafeLogger.warn("Fee-share setup consolidation failed; returning original setup transactions", {
          requestId,
          endpoint: ROUTE,
          code: failureCode,
          directSetupCount: directFeeShareSetupTransactions.length,
          transactionsCount: transactions.length,
        });
      }
    }

    const needsCreation =
      upstreamResponse.needsCreation === true ||
      hasDirectFeeShareSetupTransactions ||
      hasTransactions ||
      hasBundles;
    const publicFlowSafe = !hasDirectFeeShareSetupTransactions && !hasTransactions && !hasBundles;
    const setupTransactionCount =
      finalDirectSetup.length || finalTransactions.length || bundles.length;

    // A configKey is mandatory for the launch transaction. If Bags returns no
    // config key we cannot proceed — fail closed rather than launch blindly.
    if (!configKey) {
      SafeLogger.error("Bags create-config returned no config key", undefined, {
        requestId,
        endpoint: ROUTE,
        configAttempt,
        needsCreation,
        hasTransactions,
        hasBundles,
      });
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "BAGS_CONFIG_KEY_MISSING",
            message: "Bags create-config did not return a config key; launch cannot proceed.",
          },
          meta: { requestId, upstream: "bags", upstreamStatus: 200, elapsedMs: Date.now() - startTime },
        },
        { status: 502 },
      );
    }

    if (needsCreation || hasTransactions || hasBundles) {
      // Token Launch v2 requires the fee-share config account to exist on-chain
      // before the final launch transaction. Bags returns the setup transaction
      // (or Jito bundle) that the user signs. This rent (~0.0065 SOL) is a Bags
      // protocol requirement, not a Bags Shield fee. The setup tx is returned so
      // the client can sign it and proceed directly to the launch transaction.
      SafeLogger.info("Bags fee-share config created; setup transaction(s) returned for signing", {
        requestId,
        endpoint: ROUTE,
        configAttempt,
        setupTransactionCount,
        configKeyPresent: true,
        partnerModeEnabled,
        totalBps: feeShare.totalBps,
      });
    }

    return jsonResponse(
      req,
      requestId,
      {
        success: true,
        response: {
          ...upstreamResponse,
          transactions: finalTransactions,
          feeShareSetupTransactions: finalDirectSetup.length > 0 ? finalDirectSetup : undefined,
          setupConsolidation,
          configKey,
          meteoraConfigKey: upstreamResponse.meteoraConfigKey || configKey,
          needsCreation,
          hasTransactions,
          hasBundles,
          publicFlowSafe,
          setupTransactionCount,
          // configKey is present, so the client may proceed to the launch step.
          // When setup transactions/bundles are returned they must be signed and
          // sent before (or bundled with) the final launch transaction.
          canContinueToLaunch: true,
          requiresSetupSignature: needsCreation || hasTransactions || hasBundles,
          safety: {
            publicFlowSafe,
            needsCreation,
            hasTransactions,
            hasBundles,
            reason: publicFlowSafe
              ? "Fee-share config already exists on-chain; no setup signature required before launch."
              : "Fee-share config setup transaction(s) returned. Sign the setup tx, then sign the launch transaction to complete the launch (Bags v2 rent applies to the config account).",
          },
          feeShare: {
            feesEnabled: feeShare.feesEnabled,
            treasuryWallet: feeShare.treasuryWallet,
            partner: partnerModeEnabled ? BAGS_SHIELD_FEE_SHARE_WALLET : null,
            partnerConfig: partnerModeEnabled ? serverPartnerConfig : null,
            partnerConfigAttempt: configAttempt,
            partnerConfigFallbackUsed: false,
            claimersArray: feeShare.claimersArray,
            basisPointsArray: feeShare.basisPointsArray,
            creatorFeeShareBps: feeShare.creatorFeeShareBps,
            bagsShieldFeeShareBps: feeShare.bagsShieldFeeShareBps,
            totalBps: feeShare.totalBps,
          },
        },
        meta: {
          requestId,
          upstream: "bags",
          upstreamStatus: 200,
          configAttempt,
          partnerConfigFallbackUsed: false,
          elapsedMs: Date.now() - startTime,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    SafeLogger.error("Internal error creating Bags fee-share config", error, {
      requestId,
      endpoint: ROUTE,
      elapsedMs: Date.now() - startTime,
    });

    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        meta: { requestId, elapsedMs: Date.now() - startTime },
      },
      { status: 500 },
    );
  }
}
