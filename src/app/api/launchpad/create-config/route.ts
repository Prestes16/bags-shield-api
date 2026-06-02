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
import {
  isLaunchpadPublicWritesPaused,
  LAUNCHPAD_SAFE_MODE_PAUSED_CODE,
  LAUNCHPAD_SAFE_MODE_PAUSED_MESSAGE,
} from "@/lib/launchpad/safety";

const PARTNER_CONFIG_ENV = "LAUNCHPAD_PARTNER_CONFIG";

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

function shouldRetryWithoutPartnerConfig(result: BagsResult<BagsFeeShareConfigResponse>) {
  if (!("error" in result)) return false;

  const upstreamStatus = getUpstreamStatus(result.error.details);
  const upstreamMessage =
    getUpstreamString(result.error.details, "upstreamMessage") || result.error.message || "";
  const rawResponseHint = getUpstreamString(result.error.details, "rawResponseHint") || "";

  return (
    upstreamStatus === 500 &&
    /Bags API request failed|Internal server error/i.test(`${upstreamMessage} ${rawResponseHint}`)
  );
}

function collectFeeShareSetupTransactions(response: Record<string, unknown>) {
  const setupTransactions: Array<{ transaction: string; blockhash?: unknown }> = [];

  function addCandidate(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const record = value as Record<string, unknown>;
    const transaction = record.transaction;
    if (typeof transaction === "string" && transaction.trim()) {
      setupTransactions.push({
        transaction: transaction.trim(),
        ...(record.blockhash !== undefined ? { blockhash: record.blockhash } : {}),
      });
    }
  }

  const transactions = response.transactions;
  if (Array.isArray(transactions)) {
    for (const item of transactions) addCandidate(item);
  }

  const bundles = response.bundles;
  if (Array.isArray(bundles)) {
    for (const bundle of bundles) {
      if (Array.isArray(bundle)) {
        for (const item of bundle) addCandidate(item);
      } else {
        addCandidate(bundle);
      }
    }
  }

  addCandidate(response);
  return setupTransactions;
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

    // Resolve and validate the partner config PDA server-side.
    // Client-supplied `partnerConfig` is intentionally ignored — always overwritten.
    const serverPartnerConfig = getServerPartnerConfig();
    if (!serverPartnerConfig) {
      SafeLogger.error("Launchpad partner config is not configured on the server", undefined, {
        requestId,
        endpoint: ROUTE,
        envVar: PARTNER_CONFIG_ENV,
      });
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "LAUNCHPAD_PARTNER_CONFIG_NOT_CONFIGURED",
            message: "Launchpad partner config is not configured on the server",
          },
          meta: { requestId, elapsedMs: Date.now() - startTime },
        },
        { status: 503 },
      );
    }

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
      // partner and partnerConfig are ALWAYS server-side — client values are discarded
      partner: BAGS_SHIELD_FEE_SHARE_WALLET,
      partnerConfig: serverPartnerConfig,
      ...(input.bagsConfigType ? { bagsConfigType: input.bagsConfigType } : {}),
      ...(input.additionalLookupTables ? { additionalLookupTables: input.additionalLookupTables } : {}),
    };

    const fallbackConfig: BagsFeeShareConfigRequest = {
      payer: input.payer,
      baseMint: input.baseMint,
      claimersArray: feeShare.claimersArray,
      basisPointsArray: feeShare.basisPointsArray,
      ...(input.bagsConfigType ? { bagsConfigType: input.bagsConfigType } : {}),
      ...(input.additionalLookupTables ? { additionalLookupTables: input.additionalLookupTables } : {}),
    };

    let configAttempt = "partner_config";
    let bagsResult = await createFeeShareConfig(config);
    const attempts: Array<ReturnType<typeof summarizeAttempt>> = [
      summarizeAttempt(configAttempt, config, bagsResult),
    ];

    if ("error" in bagsResult && shouldRetryWithoutPartnerConfig(bagsResult)) {
      SafeLogger.warn("Bags fee-share config failed with partner config; retrying without optional partner fields", {
        requestId,
        endpoint: ROUTE,
        upstreamStatus: getUpstreamStatus(bagsResult.error.details),
        totalBps: getBpsTotal(config),
        claimersCount: config.claimersArray.length,
        basisPointsCount: config.basisPointsArray.length,
        hasPartner: Boolean(config.partner),
        hasPartnerConfig: Boolean(config.partnerConfig),
        fallbackKeepsBagsShieldClaimer: fallbackConfig.claimersArray.includes(BAGS_SHIELD_FEE_SHARE_WALLET),
      });

      configAttempt = "fee_share_without_partner_config";
      const fallbackResult = await createFeeShareConfig(fallbackConfig);
      attempts.push(summarizeAttempt(configAttempt, fallbackConfig, fallbackResult));
      bagsResult = fallbackResult;
    }

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
        payloadKeys: Object.keys(configAttempt === "partner_config" ? config : fallbackConfig),
        claimersCount: feeShare.claimersArray.length,
        basisPointsCount: feeShare.basisPointsArray.length,
        totalBps: feeShare.totalBps,
        hasPartner: configAttempt === "partner_config",
        hasPartnerConfig: configAttempt === "partner_config",
      });

      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "BAGS_CREATE_CONFIG_FAILED",
            message: "Bags create-config failed",
            upstreamStatus,
            upstreamCode,
            upstreamMessage: upstreamMessage || bagsResult.error.message,
            rawResponseHint,
            attempts,
          },
          meta: {
            requestId,
            upstream: "bags",
            upstreamStatus,
            configAttempt,
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
    const transactions = Array.isArray(upstreamResponse.transactions) ? upstreamResponse.transactions : [];
    const bundles = Array.isArray(upstreamResponse.bundles) ? upstreamResponse.bundles : [];
    const hasTransactions = transactions.length > 0;
    const hasBundles = bundles.length > 0;
    const needsCreation = upstreamResponse.needsCreation === true || hasTransactions || hasBundles;
    const publicFlowSafe = !hasTransactions && !hasBundles;
    const feeShareSetupTransactions = collectFeeShareSetupTransactions(upstreamResponse);

    if (feeShareSetupTransactions.length > 0) {
      const transactionLengths = feeShareSetupTransactions.map((item) => item.transaction.length);
      SafeLogger.warn("Bags fee-share config requires explicit setup transaction(s)", {
        requestId,
        endpoint: ROUTE,
        configAttempt,
        transactionCount: feeShareSetupTransactions.length,
        transactionLengths,
        configKeyPresent: Boolean(configKey),
        totalBps: feeShare.totalBps,
        tipsEnabled: false,
      });

      return jsonResponse(
        req,
        requestId,
        {
          success: true,
          response: {
            status: "fee_share_setup_required",
            requiresFeeShareSetup: true,
            feeShareSetupTransactionCount: feeShareSetupTransactions.length,
            feeShareSetupTransactions: feeShareSetupTransactions.map((item) => item.transaction),
            feeShareSetupEncoding: "base58",
            feeShareSetupTransactionLengths: transactionLengths,
            configKey,
            meteoraConfigKey: upstreamResponse.meteoraConfigKey || configKey,
            needsCreation: true,
            hasTransactions,
            hasBundles,
            publicFlowSafe: false,
            feeShare: {
              feesEnabled: feeShare.feesEnabled,
              treasuryWallet: feeShare.treasuryWallet,
              partner: configAttempt === "partner_config" ? BAGS_SHIELD_FEE_SHARE_WALLET : null,
              partnerConfig: configAttempt === "partner_config" ? serverPartnerConfig : null,
              partnerConfigAttempt: configAttempt,
              partnerConfigFallbackUsed: configAttempt !== "partner_config",
              claimersArray: feeShare.claimersArray,
              basisPointsArray: feeShare.basisPointsArray,
              creatorFeeShareBps: feeShare.creatorFeeShareBps,
              bagsShieldFeeShareBps: feeShare.bagsShieldFeeShareBps,
              totalBps: feeShare.totalBps,
            },
            tips: {
              enabled: false,
              tipWallet: null,
              tipLamports: 0,
            },
            warning:
              "Fee-share setup requires separate transaction(s). Continue only in internal mode.",
            safety: {
              publicFlowSafe: false,
              needsCreation: true,
              hasTransactions,
              hasBundles,
              reason:
                "Fee-share setup requires explicit user-signed setup transaction(s) before the final launch transaction.",
            },
          },
          meta: {
            requestId,
            upstream: "bags",
            upstreamStatus: 200,
            configAttempt,
            partnerConfigFallbackUsed: configAttempt !== "partner_config",
            elapsedMs: Date.now() - startTime,
          },
        },
        { status: 201 },
      );
    }

    return jsonResponse(
      req,
      requestId,
      {
        success: true,
        response: {
          ...upstreamResponse,
          configKey,
          meteoraConfigKey: upstreamResponse.meteoraConfigKey || configKey,
          needsCreation,
          hasTransactions,
          hasBundles,
          publicFlowSafe,
          safety: {
            publicFlowSafe,
            needsCreation,
            hasTransactions,
            hasBundles,
            reason: publicFlowSafe
              ? "Fee-share config does not require a separate public-flow signature."
              : "Fee-share config returned separate transactions/bundles and is unsafe for public launch flow while Safety Gate is active.",
          },
          feeShare: {
            feesEnabled: feeShare.feesEnabled,
            treasuryWallet: feeShare.treasuryWallet,
            partner: configAttempt === "partner_config" ? BAGS_SHIELD_FEE_SHARE_WALLET : null,
            partnerConfig: configAttempt === "partner_config" ? serverPartnerConfig : null,
            partnerConfigAttempt: configAttempt,
            partnerConfigFallbackUsed: configAttempt !== "partner_config",
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
          partnerConfigFallbackUsed: configAttempt !== "partner_config",
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
