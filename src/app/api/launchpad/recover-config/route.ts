/**
 * POST /api/launchpad/recover-config
 *
 * PAID_SETUP_RECOVERY: preserve paid on-chain setup and recover config idempotently
 * RECOVERY_OWNERSHIP_GATE: registry provenance must belong to the requesting wallet
 * VERIFIED_SETUP_SIGNATURE_GATE: confirmed status alone is not sufficient
 * UNTRUSTED_CLIENT_CONFIG_KEY: expectedConfigKey is never an authoritative source
 *
 * Recovery idempotente de um fee-share setup JÁ PAGO. Esta rota NUNCA:
 *  - gera novas setup transactions;
 *  - retorna transações para assinatura;
 *  - solicita novas assinaturas;
 *  - apaga recovery/provenance;
 *  - aceita provenance de outra wallet nem chave do cliente como fonte de verdade.
 *
 * Fluxo:
 *  1. valida wallet, baseMint e assinaturas;
 *  2. confirma cada assinatura on-chain E prova o vínculo de cada transação
 *     (wallet signer + baseMint referenciado + programa Bags/Meteora reconhecido);
 *  3. procura configKey no registro de provenance COM ownership obrigatório;
 *  4. como último recheck seguro, chama o create-config da Bags em modo
 *     estritamente idempotente — setup transactions retornadas são DESCARTADAS.
 *
 * A decisão é centralizada em decideConfigRecovery (pura/testável):
 * src/lib/launchpad/recovery-decision.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { z } from "zod";
import {
  getOrGenerateRequestId,
  safeJsonParse,
  checkRateLimitByIp,
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
  SafeLogger,
} from "@/lib/security";
import { handlePreflight } from "@/lib/security/cors";
import {
  createFeeShareConfig,
  type BagsFeeShareConfigRequest,
} from "@/lib/launchpad/bags-client";
import { buildLaunchpadFeeShare } from "@/lib/launchpad/fees";
import {
  getLaunchProvenanceByMintAndWallet,
  upsertOwnedLaunchProvenance,
} from "@/lib/launchpad/launch-registry";
import {
  decideConfigRecovery,
  type RecoveryOutcome,
  type RecoveryRecheckInput,
  type RecoverySignatureState,
  type RegistryOwnership,
} from "@/lib/launchpad/recovery-decision";
import {
  extractSetupTransactionFacts,
  verifySetupTransactionFacts,
} from "@/lib/launchpad/recovery-transaction-verifier";
import { getLaunchpadMode, isLaunchpadEnabled } from "@/lib/env";

export const runtime = "nodejs";

const ROUTE = "/api/launchpad/recover-config";
const MAX_SIGNATURES = 10;
const SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{80,100}$/;

function isPublicKey(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

const recoverConfigRequestSchema = z.object({
  wallet: z.string().refine(isPublicKey, "Invalid wallet public key"),
  baseMint: z.string().refine(isPublicKey, "Invalid baseMint public key"),
  setupSignatures: z
    .array(z.string().regex(SIGNATURE_PATTERN, "Invalid signature format"))
    .min(1, "At least one setup signature is required")
    .max(MAX_SIGNATURES, `Maximum ${MAX_SIGNATURES} signatures per request`),
  expectedConfigKey: z.string().refine(isPublicKey, "Invalid configKey public key").optional(),
});

function jsonResponse(req: NextRequest, requestId: string, body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set("X-Request-Id", requestId);
  return res;
}

function getLaunchRpcUrl(): string | null {
  const rpcUrl = (process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL || "").trim();
  return rpcUrl || null;
}

function extractRecheckRecord(raw: unknown): Record<string, unknown> {
  const root = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  for (const key of ["response", "result", "data", "config", "feeShareConfig"]) {
    const nested = root[key];
    if (
      nested && typeof nested === "object" && !Array.isArray(nested) &&
      ["needsCreation", "meteoraConfigKey", "configKey", "transactions"].some((k) => k in (nested as object))
    ) {
      return nested as Record<string, unknown>;
    }
  }
  return root;
}

function pickRecheckConfigKey(record: Record<string, unknown>): string | null {
  for (const field of ["configKey", "meteoraConfigKey", "config_key", "meteora_config_key"]) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function hasPendingSetupTransactions(record: Record<string, unknown>): boolean {
  const transactions = Array.isArray(record.transactions) ? record.transactions : [];
  const direct = Array.isArray(record.feeShareSetupTransactions) ? record.feeShareSetupTransactions : [];
  const bundles = Array.isArray(record.bundles) ? record.bundles : [];
  return transactions.length > 0 || direct.length > 0 || bundles.length > 0;
}

const BLOCKED_MESSAGES: Record<string, string> = {
  CONFIG_RECOVERY_UNRESOLVED:
    "Recovery cannot be completed automatically. No authoritative source has the configKey for this paid setup; do NOT sign a new setup. Retry later or contact support with the requestId.",
  CONFIG_RECOVERY_PENDING:
    "Recovery is not resolvable yet. The paid setup is preserved; retry shortly without signing anything new.",
  CONFIG_KEY_MISMATCH:
    "The configKey on record does not match the locally stored configKey. Final launch blocked to avoid duplicate fees.",
  BAGS_CONFIG_NOT_READY:
    "Setup transactions are confirmed on-chain, but Bags has not indexed the fee-share config yet. Retry recovery shortly; do NOT sign a new setup.",
  RECOVERY_OWNERSHIP_MISMATCH:
    "A launch provenance exists for this mint but belongs to a different wallet. Recovery blocked; no new signature is required.",
  SETUP_SIGNATURE_NOT_FOUND:
    "A setup signature could not be loaded from the ledger yet. Retry shortly; do NOT sign a new setup.",
  SETUP_SIGNATURE_FAILED:
    "At least one setup transaction failed on-chain. This recovery cannot be completed automatically; do not sign a new setup before reviewing the failed transaction.",
  SETUP_SIGNATURE_WALLET_MISMATCH:
    "The requesting wallet is not a signer of the provided setup transaction. Recovery blocked.",
  SETUP_SIGNATURE_MINT_MISMATCH:
    "The provided setup transaction does not reference this baseMint. Recovery blocked.",
  SETUP_TRANSACTION_UNVERIFIABLE:
    "The setup transaction linkage could not be verified (lookup tables unresolved). Retry shortly; do NOT sign a new setup.",
  SETUP_TRANSACTION_NOT_RECOGNIZED:
    "The provided transaction does not invoke a recognized Bags fee-share/launch program. Recovery blocked.",
};

function blockedHttpStatus(outcome: Extract<RecoveryOutcome, { outcome: "blocked" }>, upstreamFailed: boolean): number {
  if (upstreamFailed) return 502;
  if (outcome.code === "CONFIG_RECOVERY_UNRESOLVED" && outcome.allSetupConfirmed) return 502;
  return 409;
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ["POST"]);
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = getOrGenerateRequestId(req.headers);

  if (!isLaunchpadEnabled() || getLaunchpadMode() !== "real") {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "FEATURE_DISABLED", message: "Launchpad feature is not enabled in real mode" },
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
        headers: { "Retry-After": String(Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000)) },
      },
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
        meta: { requestId },
      },
      { status: 415 },
    );
  }

  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "BAD_REQUEST", message: "Failed to read request body" },
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
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  const validation = recoverConfigRequestSchema.safeParse(parseResult.data);
  if (!validation.success) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "VALIDATION_FAILED", message: "Request validation failed" },
        issues: validation.error.issues.map((issue) => ({
          path: issue.path.join(".") || "<root>",
          message: issue.message,
        })),
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  const { wallet, baseMint, setupSignatures, expectedConfigKey } = validation.data;

  const rpcUrl = getLaunchRpcUrl();
  if (!rpcUrl) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "RPC_NOT_CONFIGURED", message: "Solana RPC is not configured; cannot verify setup signatures" },
        response: { state: "recovery_blocked", allSetupConfirmed: false, configReady: false, retrySafe: true, newSetupRequired: false },
        meta: { requestId },
      },
      { status: 503 },
    );
  }

  try {
    // 1-2. Confirma cada assinatura on-chain E prova o vínculo da transação.
    const connection = new Connection(rpcUrl, "confirmed");
    const statusResponse = await connection.getSignatureStatuses(setupSignatures, {
      searchTransactionHistory: true,
    });

    const signatureStates: RecoverySignatureState[] = await Promise.all(
      setupSignatures.map(async (signature, index): Promise<RecoverySignatureState> => {
        const status = statusResponse.value[index];
        if (!status) return { signature, status: "not_found" };
        if (status.err) return { signature, status: "failed" };
        const confirmed =
          status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized";
        if (!confirmed) return { signature, status: "pending" };

        // VERIFIED_SETUP_SIGNATURE_GATE: carrega a transação (versioned +
        // lookup tables) e prova wallet signer + baseMint + programa Bags.
        const transaction = await connection.getTransaction(signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
        if (!transaction) {
          return { signature, status: "confirmed", verificationCode: "SETUP_SIGNATURE_NOT_FOUND" };
        }
        const facts = extractSetupTransactionFacts(signature, transaction);
        const verification = verifySetupTransactionFacts({ wallet, baseMint, facts });
        return {
          signature,
          status: "confirmed",
          ...(verification.valid ? {} : { verificationCode: verification.code }),
        };
      }),
    );

    // 3. RECOVERY_OWNERSHIP_GATE: provenance só vale se pertencer à wallet.
    const owned = await getLaunchProvenanceByMintAndWallet(baseMint, wallet);
    const registryOwnership: RegistryOwnership = owned.status;
    const registryConfigKey = owned.status === "owned" ? owned.configKey : null;

    // Primeira decisão sem recheck: resolve por registro próprio, ou bloqueia
    // por assinaturas falhas/não vinculadas/pendentes/ownership/mismatch.
    let decision = decideConfigRecovery({
      signatureStates,
      registryOwnership,
      registryConfigKey,
      expectedConfigKey,
      recheck: null,
    });

    let upstreamFailed = false;
    let upstreamStatus: number | null = null;
    let upstreamMessage: string | null = null;

    // 4. Recheck idempotente apenas quando o setup está confirmado/vinculado e
    // o registro não resolveu (decisão "pendente com tudo confirmado").
    const needsRecheck =
      decision.outcome === "blocked" &&
      decision.code === "CONFIG_RECOVERY_PENDING" &&
      decision.allSetupConfirmed;

    if (needsRecheck) {
      let recheck: RecoveryRecheckInput;
      try {
        const feeShare = buildLaunchpadFeeShare(wallet);
        const recheckRequest: BagsFeeShareConfigRequest = {
          payer: wallet,
          baseMint,
          claimersArray: feeShare.claimersArray,
          basisPointsArray: feeShare.basisPointsArray,
        };
        const recheckResult = await createFeeShareConfig(recheckRequest);

        if ("error" in recheckResult) {
          const details = recheckResult.error.details as Record<string, unknown> | undefined;
          upstreamFailed = true;
          upstreamStatus = typeof details?.status === "number" ? details.status : null;
          upstreamMessage =
            (typeof details?.upstreamMessage === "string" && details.upstreamMessage) ||
            recheckResult.error.message ||
            null;
          recheck = { ok: false, upstreamStatus, upstreamMessage };
        } else {
          const record = extractRecheckRecord(recheckResult.response);
          recheck = {
            ok: true,
            needsCreation: record.needsCreation === true,
            // Qualquer setup tx retornada é DESCARTADA aqui — nunca repassada.
            hasSetupTransactions: hasPendingSetupTransactions(record),
            configKey: pickRecheckConfigKey(record),
          };
        }
      } catch (error) {
        upstreamFailed = true;
        upstreamMessage = error instanceof Error ? error.message : null;
        recheck = { ok: false, upstreamMessage };
      }

      decision = decideConfigRecovery({
        signatureStates,
        registryOwnership,
        registryConfigKey,
        expectedConfigKey,
        recheck,
      });
    }

    if (decision.outcome === "ready") {
      // DURABLE_PROVENANCE_BEFORE_SIGNATURE: persiste com guard de ownership e
      // reporta o resultado REAL — nunca declara persistência que falhou.
      const persistence = await upsertOwnedLaunchProvenance({
        mint: baseMint,
        requestingWallet: wallet,
        creatorWallet: wallet,
        launchWallet: wallet,
        configKey: decision.configKey,
        launchStatus: "config_created",
      });

      SafeLogger.info("Launchpad config recovered for paid setup", {
        requestId,
        endpoint: ROUTE,
        source: decision.source,
        signatureCount: setupSignatures.length,
        provenancePersisted: persistence.persisted,
        provenanceConflict: persistence.conflict,
        elapsedMs: Date.now() - startTime,
      });

      // Conflito de ownership/chave detectado na persistência: bloqueia em vez
      // de liberar uma final possivelmente errada.
      if (persistence.conflict) {
        return jsonResponse(
          req,
          requestId,
          {
            success: false,
            error: {
              code: persistence.reason === "config_key_mismatch" ? "CONFIG_KEY_MISMATCH" : "RECOVERY_OWNERSHIP_MISMATCH",
              message: BLOCKED_MESSAGES[persistence.reason === "config_key_mismatch" ? "CONFIG_KEY_MISMATCH" : "RECOVERY_OWNERSHIP_MISMATCH"],
            },
            response: {
              state: "recovery_blocked",
              allSetupConfirmed: true,
              configReady: false,
              retrySafe: false,
              newSetupRequired: false,
              provenancePersisted: false,
            },
            meta: { requestId, elapsedMs: Date.now() - startTime },
          },
          { status: 409 },
        );
      }

      return jsonResponse(
        req,
        requestId,
        {
          success: true,
          response: {
            state: decision.state,
            configKey: decision.configKey,
            baseMint,
            setupSignatures,
            allSetupConfirmed: true,
            configReady: true,
            source: decision.source,
            newSetupRequired: false,
            provenancePersisted: persistence.persisted,
            signatures: signatureStates,
          },
          meta: { requestId, elapsedMs: Date.now() - startTime },
        },
        { status: 200 },
      );
    }

    SafeLogger.warn("Launchpad config recovery blocked", {
      requestId,
      endpoint: ROUTE,
      code: decision.code,
      state: decision.state,
      allSetupConfirmed: decision.allSetupConfirmed,
      retrySafe: decision.retrySafe,
      registryOwnership,
      upstreamFailed,
      upstreamStatus,
      elapsedMs: Date.now() - startTime,
    });

    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: decision.code,
          message: BLOCKED_MESSAGES[decision.code] || "Config recovery is not resolvable yet.",
          ...(upstreamStatus != null ? { upstreamStatus } : {}),
          ...(upstreamMessage ? { upstreamMessage } : {}),
        },
        response: {
          state: decision.state,
          allSetupConfirmed: decision.allSetupConfirmed,
          configReady: false,
          retrySafe: decision.retrySafe,
          newSetupRequired: false,
          provenancePersisted: false,
          signatures: signatureStates,
        },
        meta: { requestId, elapsedMs: Date.now() - startTime },
      },
      { status: blockedHttpStatus(decision, upstreamFailed) },
    );
  } catch (error) {
    SafeLogger.error("Launchpad recover-config failed", error, {
      requestId,
      endpoint: ROUTE,
      elapsedMs: Date.now() - startTime,
    });
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "CONFIG_RECOVERY_PENDING", message: "Recovery check failed unexpectedly. The paid setup is preserved; retry shortly." },
        response: { state: "recovery_blocked", allSetupConfirmed: false, configReady: false, retrySafe: true, newSetupRequired: false, provenancePersisted: false },
        meta: { requestId, elapsedMs: Date.now() - startTime },
      },
      { status: 502 },
    );
  }
}
