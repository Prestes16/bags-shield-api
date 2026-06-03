/**
 * POST /api/launchpad/setup-status
 *
 * Read-only ledger diagnostic for fee-share setup signatures. It never signs,
 * sends, broadcasts, mutates launch provenance, or returns serialized tx data.
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

export const runtime = "nodejs";

const ROUTE = "/api/launchpad/setup-status";
const MAX_SIGNATURES = 10;
const SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{80,100}$/;

const setupStatusRequestSchema = z.object({
  signatures: z
    .array(z.string().regex(SIGNATURE_PATTERN, "Invalid signature format"))
    .min(1, "At least one signature is required")
    .max(MAX_SIGNATURES, `Maximum ${MAX_SIGNATURES} signatures per request`),
  wallet: z.string().refine(isPublicKey, "Invalid wallet public key").optional(),
  configKey: z.string().refine(isPublicKey, "Invalid configKey public key").optional(),
  baseMint: z.string().refine(isPublicKey, "Invalid baseMint public key").optional(),
});

type SignatureStatus = "confirmed" | "pending" | "failed" | "not_found";

type SolDelta = {
  address: string;
  lamports: number;
  sol: number;
  role?: "fee_payer" | "wallet" | "recipient";
};

type SetupSignatureDiagnostic = {
  signature: string;
  status: SignatureStatus;
  slot?: number;
  blockTime?: number | null;
  feeLamports?: number;
  walletDeltaLamports?: number;
  solDeltas?: SolDelta[];
  programIds?: string[];
  instructionCount?: number;
  innerInstructionCount?: number;
  error?: unknown;
};

function isPublicKey(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function getLaunchRpcUrl(): string | null {
  const rpcUrl = (process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL || "").trim();
  return rpcUrl || null;
}

function jsonResponse(
  req: NextRequest,
  requestId: string,
  body: unknown,
  init?: ResponseInit,
) {
  const res = NextResponse.json(body, init);
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set("X-Request-Id", requestId);
  return res;
}

function keyToString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof (value as { toBase58?: unknown }).toBase58 === "function") {
    return (value as { toBase58: () => string }).toBase58();
  }
  if (typeof (value as { toString?: unknown }).toString === "function") {
    return (value as { toString: () => string }).toString();
  }
  return null;
}

function getAccountKeys(transaction: unknown): string[] {
  const tx = transaction as {
    transaction?: {
      message?: {
        getAccountKeys?: (args?: unknown) => { length: number; get: (index: number) => unknown };
        accountKeys?: unknown[];
        staticAccountKeys?: unknown[];
      };
    };
    meta?: { loadedAddresses?: unknown };
  };

  const message = tx.transaction?.message;
  if (!message) return [];

  if (typeof message.getAccountKeys === "function") {
    try {
      const accountKeys = message.getAccountKeys({
        accountKeysFromLookups: tx.meta?.loadedAddresses ?? undefined,
      });
      const keys: string[] = [];
      for (let i = 0; i < accountKeys.length; i += 1) {
        const key = keyToString(accountKeys.get(i));
        if (key) keys.push(key);
      }
      if (keys.length > 0) return keys;
    } catch {
      try {
        const accountKeys = message.getAccountKeys();
        const keys: string[] = [];
        for (let i = 0; i < accountKeys.length; i += 1) {
          const key = keyToString(accountKeys.get(i));
          if (key) keys.push(key);
        }
        if (keys.length > 0) return keys;
      } catch {
        // fall through to array-based extraction
      }
    }
  }

  const directKeys = Array.isArray(message.accountKeys)
    ? message.accountKeys
    : Array.isArray(message.staticAccountKeys)
      ? message.staticAccountKeys
      : [];

  return directKeys.map(keyToString).filter((key): key is string => Boolean(key));
}

function getInstructions(transaction: unknown): unknown[] {
  const tx = transaction as {
    transaction?: {
      message?: {
        compiledInstructions?: unknown[];
        instructions?: unknown[];
      };
    };
  };
  const message = tx.transaction?.message;
  if (Array.isArray(message?.compiledInstructions)) return message.compiledInstructions;
  if (Array.isArray(message?.instructions)) return message.instructions;
  return [];
}

function collectProgramIds(transaction: unknown, accountKeys: string[]): string[] {
  const programIds = new Set<string>();

  const addInstruction = (instruction: unknown) => {
    const ix = instruction as { programIdIndex?: unknown; programId?: unknown };
    const programId = keyToString(ix.programId);
    if (programId) {
      programIds.add(programId);
      return;
    }
    if (typeof ix.programIdIndex === "number") {
      const key = accountKeys[ix.programIdIndex];
      if (key) programIds.add(key);
    }
  };

  for (const instruction of getInstructions(transaction)) addInstruction(instruction);

  const tx = transaction as {
    meta?: { innerInstructions?: Array<{ instructions?: unknown[] }> };
  };
  for (const group of tx.meta?.innerInstructions ?? []) {
    if (Array.isArray(group.instructions)) {
      for (const instruction of group.instructions) addInstruction(instruction);
    }
  }

  return Array.from(programIds);
}

function getSolDeltas(transaction: unknown, accountKeys: string[], wallet?: string): SolDelta[] {
  const tx = transaction as {
    meta?: {
      preBalances?: number[];
      postBalances?: number[];
    };
  };
  const preBalances = tx.meta?.preBalances ?? [];
  const postBalances = tx.meta?.postBalances ?? [];
  const deltas: SolDelta[] = [];

  for (let i = 0; i < Math.min(accountKeys.length, preBalances.length, postBalances.length); i += 1) {
    const lamports = Number(postBalances[i]) - Number(preBalances[i]);
    if (!Number.isFinite(lamports) || lamports === 0) continue;
    const address = accountKeys[i];
    deltas.push({
      address,
      lamports,
      sol: lamports / 1_000_000_000,
      role: i === 0 ? "fee_payer" : wallet && address === wallet ? "wallet" : lamports > 0 ? "recipient" : undefined,
    });
  }

  return deltas;
}

function summarizeLedgerTransaction(
  signature: string,
  transaction: unknown,
  wallet?: string,
): SetupSignatureDiagnostic {
  const tx = transaction as {
    slot?: number;
    blockTime?: number | null;
    meta?: {
      err?: unknown;
      fee?: number;
      innerInstructions?: Array<{ instructions?: unknown[] }>;
    } | null;
  };
  const accountKeys = getAccountKeys(transaction);
  const solDeltas = getSolDeltas(transaction, accountKeys, wallet);
  const programIds = collectProgramIds(transaction, accountKeys);
  const walletDelta = wallet
    ? solDeltas.find((delta) => delta.address === wallet)?.lamports ?? 0
    : undefined;
  const innerInstructionCount = (tx.meta?.innerInstructions ?? [])
    .reduce((sum, group) => sum + (Array.isArray(group.instructions) ? group.instructions.length : 0), 0);

  return {
    signature,
    status: tx.meta?.err ? "failed" : "confirmed",
    slot: tx.slot,
    blockTime: tx.blockTime,
    feeLamports: tx.meta?.fee,
    walletDeltaLamports: walletDelta,
    solDeltas,
    programIds,
    instructionCount: getInstructions(transaction).length,
    innerInstructionCount,
    ...(tx.meta?.err ? { error: tx.meta.err } : {}),
  };
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ["POST"]);
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = getOrGenerateRequestId(req.headers);

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
        },
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

  const validation = setupStatusRequestSchema.safeParse(parseResult.data);
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

  const { signatures, wallet, configKey, baseMint } = validation.data;

  const rpcUrl = getLaunchRpcUrl();
  if (!rpcUrl) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: "RPC_NOT_CONFIGURED",
          message: "Solana RPC is not configured; cannot check setup transaction status",
        },
        meta: { requestId },
      },
      { status: 503 },
    );
  }

  try {
    const connection = new Connection(rpcUrl, "confirmed");
    const statusResponse = await connection.getSignatureStatuses(signatures, {
      searchTransactionHistory: true,
    });

    const diagnostics = await Promise.all(signatures.map(async (signature, index) => {
      const status = statusResponse.value[index];
      const transaction = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      if (transaction) {
        return summarizeLedgerTransaction(signature, transaction, wallet);
      }

      if (status?.err) {
        return {
          signature,
          status: "failed" as SignatureStatus,
          slot: status.slot,
          error: status.err,
        };
      }

      if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
        return {
          signature,
          status: "pending" as SignatureStatus,
          slot: status.slot,
        };
      }

      return { signature, status: "not_found" as SignatureStatus };
    }));

    const failed = diagnostics.some((item) => item.status === "failed");
    const missing = diagnostics.some((item) => item.status === "not_found");
    const pending = diagnostics.some((item) => item.status === "pending");
    const allConfirmed = diagnostics.length > 0 && diagnostics.every((item) => item.status === "confirmed");

    const ledgerConfirmed = allConfirmed && !failed;
    const canContinueToLaunch = false;
    const reason = failed
      ? "At least one setup transaction failed on-chain."
      : missing
        ? "At least one setup transaction was not found on-chain."
        : pending
          ? "At least one setup transaction is not fully available from the ledger yet."
          : ledgerConfirmed
            ? "All provided setup transactions are confirmed on-chain, but this read-only check cannot prove Bags config readiness. Do not request another signature until create-config returns a config key without setup transactions."
            : "No confirmed setup transaction was found.";

    SafeLogger.info("Launchpad setup status check completed", {
      requestId,
      endpoint: ROUTE,
      count: signatures.length,
      confirmed: diagnostics.filter((item) => item.status === "confirmed").length,
      failed: diagnostics.filter((item) => item.status === "failed").length,
      notFound: diagnostics.filter((item) => item.status === "not_found").length,
      pending: diagnostics.filter((item) => item.status === "pending").length,
      hasWallet: Boolean(wallet),
      hasConfigKey: Boolean(configKey),
      hasBaseMint: Boolean(baseMint),
      elapsedMs: Date.now() - startTime,
    });

    return jsonResponse(
      req,
      requestId,
      {
        success: true,
        response: {
          signatures: diagnostics,
          ledgerConfirmed,
          canContinueToLaunch,
          reason,
        },
        meta: { requestId, elapsedMs: Date.now() - startTime },
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const messageLower = message.toLowerCase();

    const isUnavailable =
      messageLower.includes("timeout") ||
      messageLower.includes("econnrefused") ||
      messageLower.includes("enotfound") ||
      messageLower.includes("network") ||
      messageLower.includes("socket");
    const isInvalidSignature =
      messageLower.includes("signature") &&
      (messageLower.includes("invalid") ||
        messageLower.includes("wrongsize") ||
        messageLower.includes("wrong size") ||
        messageLower.includes("base58"));

    SafeLogger.error("Launchpad setup status RPC check failed", error, {
      requestId,
      endpoint: ROUTE,
      errorCode: isInvalidSignature
        ? "INVALID_SIGNATURE"
        : isUnavailable
          ? "RPC_UNAVAILABLE"
          : "STATUS_CHECK_FAILED",
      elapsedMs: Date.now() - startTime,
    });

    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: isInvalidSignature
            ? "INVALID_SIGNATURE"
            : isUnavailable
              ? "RPC_UNAVAILABLE"
              : "STATUS_CHECK_FAILED",
          message: isInvalidSignature
            ? "One or more signatures are not valid Solana transaction signatures"
            : isUnavailable
              ? "RPC endpoint is unreachable; try again shortly"
              : "Failed to check setup transaction status",
        },
        meta: { requestId, elapsedMs: Date.now() - startTime },
      },
      { status: isInvalidSignature ? 400 : isUnavailable ? 503 : 502 },
    );
  }
}
