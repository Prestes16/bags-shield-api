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
import { upsertOwnedLaunchProvenance } from "@/lib/launchpad/launch-registry";

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

/**
 * Bags pode aninhar o payload util em formatos alternativos (`response`,
 * `result`, `data`, `config`, `feeShareConfig`) dependendo da rota/versão.
 * Normaliza para o primeiro objeto que contenha campos reconhecíveis do
 * FeeShareConfigV2Response (docs.bags.fm: needsCreation/meteoraConfigKey são
 * obrigatórios no shape v2).
 */
const CONFIG_SIGNAL_KEYS = [
  "needsCreation",
  "meteoraConfigKey",
  "configKey",
  "feeShareAuthority",
  "transactions",
  "feeShareSetupTransactions",
  "bundles",
] as const;

function extractConfigRecord(raw: unknown): Record<string, unknown> {
  const root = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const candidates: Record<string, unknown>[] = [root];
  for (const key of ["response", "result", "data", "config", "feeShareConfig"]) {
    const nested = root[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      candidates.push(nested as Record<string, unknown>);
    }
  }
  for (const candidate of candidates) {
    if (CONFIG_SIGNAL_KEYS.some((key) => key in candidate)) return candidate;
  }
  return root;
}

const CONFIG_KEY_FIELDS = [
  "configKey",
  "meteoraConfigKey",
  "config_key",
  "meteora_config_key",
  "poolConfigKey",
  "pool_config_key",
] as const;

function pickConfigKey(response: Record<string, unknown>) {
  for (const field of CONFIG_KEY_FIELDS) {
    const value = response[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
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
            // Propaga a mensagem upstream real em vez de um erro genérico.
            message: [
              partnerModeEnabled
                ? "Bags create-config (fee-share with partner) request failed"
                : "Bags create-config (fee-share) request failed",
              upstreamMessage ? `Bags: ${upstreamMessage}` : null,
            ].filter(Boolean).join(". "),
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
          // Repassa o status upstream quando ele é acionável pelo cliente
          // (4xx) em vez de converter tudo em 502 genérico. 5xx upstream e
          // shapes inesperados continuam mapeados para 502 (bad gateway).
          status: bagsResult.error.code === "BAGS_NOT_CONFIGURED"
            ? 503
            : upstreamStatus && [400, 401, 403, 404, 409, 422, 429].includes(upstreamStatus)
              ? upstreamStatus
              : 502,
        },
      );
    }

    // Normaliza formatos alternativos de resposta da Bags (envelope/nesting
    // variável) antes de extrair os campos do FeeShareConfigV2Response.
    const rawUpstream = bagsResult.response;
    const upstreamResponse = extractConfigRecord(rawUpstream);
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

    // A configKey is mandatory for the launch transaction.
    if (!configKey) {
      const responseShapeHint = Object.keys(upstreamResponse).slice(0, 12);
      // Config JÁ EXISTE on-chain (needsCreation === false) e nenhuma nova
      // setup transaction foi retornada: o setup foi pago e confirmado em
      // tentativa anterior. Não bloqueia o recovery com 502 — devolve sucesso
      // com configReady e configKey null para o cliente reutilizar a chave
      // persistida localmente. Nenhuma nova assinatura, nenhuma nova fee.
      const configAlreadyExists =
        upstreamResponse.needsCreation === false &&
        !hasDirectFeeShareSetupTransactions &&
        !hasTransactions &&
        !hasBundles;

      if (configAlreadyExists) {
        SafeLogger.warn("Bags fee-share config already exists; upstream omitted config key (client recovery key required)", {
          requestId,
          endpoint: ROUTE,
          configAttempt,
          responseShapeHint,
        });
        return jsonResponse(
          req,
          requestId,
          {
            success: true,
            response: {
              ...upstreamResponse,
              configKey: null,
              meteoraConfigKey: null,
              configKeySource: "client_recovery_required",
              configReady: true,
              needsCreation: false,
              hasTransactions: false,
              hasBundles: false,
              publicFlowSafe: true,
              setupTransactionCount: 0,
              transactions: [],
              canContinueToLaunch: true,
              requiresSetupSignature: false,
              safety: {
                publicFlowSafe: true,
                needsCreation: false,
                hasTransactions: false,
                hasBundles: false,
                reason:
                  "Fee-share config already exists on-chain. Bags did not echo the config key; reuse the locally persisted configKey from the original setup. No new signature or fee is required.",
              },
            },
            meta: { requestId, upstream: "bags", upstreamStatus: 200, elapsedMs: Date.now() - startTime },
          },
          { status: 200 },
        );
      }

      // Shape inesperado E criação aparentemente necessária: fail closed, mas
      // com diagnóstico completo em vez de 502 opaco.
      SafeLogger.error("Bags create-config returned no config key", undefined, {
        requestId,
        endpoint: ROUTE,
        configAttempt,
        needsCreation,
        hasTransactions,
        hasBundles,
        responseShapeHint,
      });
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "BAGS_CONFIG_KEY_MISSING",
            message: "Bags create-config did not return a config key; launch cannot proceed.",
            upstreamStatus: 200,
            needsCreation: upstreamResponse.needsCreation ?? null,
            responseShapeHint,
          },
          meta: { requestId, upstream: "bags", upstreamStatus: 200, elapsedMs: Date.now() - startTime },
        },
        { status: 502 },
      );
    }

    // DURABLE_PROVENANCE_BEFORE_SIGNATURE: persist recovery data before returning paid setup transactions
    // A provenance (wallet/mint/configKey/status) é persistida de forma
    // SÍNCRONA e com guard de ownership ANTES de entregar setup transactions.
    // Se há transações pagáveis e a persistência falhar, NÃO entregamos as
    // transações — sem registro durável não há recovery garantido do rent.
    const willReturnSetupTransactions = needsCreation || hasTransactions || hasBundles;
    const persistence = await upsertOwnedLaunchProvenance({
      mint: input.baseMint,
      requestingWallet: input.payer,
      creatorWallet: input.payer,
      launchWallet: input.payer,
      configKey,
      launchStatus: "config_created",
    });

    if (persistence.conflict) {
      // RECOVERY_OWNERSHIP_GATE: registro existente incompatível (outra wallet
      // ou outra configKey) — nunca sobrescrever; bloquear sem pedir assinatura.
      SafeLogger.warn("Launchpad create-config blocked by provenance ownership conflict", {
        requestId,
        endpoint: ROUTE,
        reason: persistence.reason,
      });
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "RECOVERY_OWNERSHIP_MISMATCH",
            message:
              "A launch provenance already exists for this mint with a different wallet or configKey. No signature should be requested.",
          },
          response: {
            canRequestSignature: false,
            canContinueToLaunch: false,
            newSetupRequired: false,
          },
          meta: { requestId, elapsedMs: Date.now() - startTime },
        },
        { status: 409 },
      );
    }

    if (willReturnSetupTransactions && !persistence.persisted) {
      SafeLogger.error("Launchpad create-config could not persist provenance before paid setup", undefined, {
        requestId,
        endpoint: ROUTE,
        setupTransactionCount,
      });
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "PROVENANCE_PERSISTENCE_FAILED",
            message:
              "The launch provenance could not be durably persisted. To protect the paid setup, no setup transaction was returned and NO signature should be requested. Retry shortly.",
          },
          response: {
            canRequestSignature: false,
            canContinueToLaunch: false,
            newSetupRequired: false,
          },
          meta: { requestId, elapsedMs: Date.now() - startTime },
        },
        { status: 503 },
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
          configKeySource: "upstream",
          provenancePersisted: persistence.persisted,
          // Config pronta = já existe on-chain e nenhuma setup tx pendente.
          configReady: !needsCreation && !hasTransactions && !hasBundles,
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
