/**
 * POST /api/launchpad/send
 *
 * Broadcasts a transaction already signed by the user's wallet. This route
 * never signs, never loads a private key, and never accepts unsigned payloads.
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
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
  launchpadSendRequestSchema,
  validateLaunchpadInput,
} from "@/lib/launchpad/schemas";
import {
  updateUserLaunchConfirmed,
  updateUserLaunchSubmitted,
} from "@/lib/launchpad/launch-registry";
import {
  isLaunchpadPublicWritesPaused,
  LAUNCHPAD_SAFE_MODE_PAUSED_CODE,
  LAUNCHPAD_SAFE_MODE_PAUSED_MESSAGE,
} from "@/lib/launchpad/safety";

export const runtime = "nodejs";

const ROUTE = "/api/launchpad/send";
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_MAP = new Map(BASE58_ALPHABET.split("").map((char, index) => [char, index]));
const CONFIRMATION_ATTEMPTS = 12;
const CONFIRMATION_INTERVAL_MS = 1000;

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

function getLaunchRpcUrl() {
  const rpcUrl = (process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL || "").trim();
  return rpcUrl || null;
}

function decodeBase58(value: string): Uint8Array {
  const bytes = [0];

  for (const char of value) {
    const mapped = BASE58_MAP.get(char);
    if (mapped === undefined) {
      throw new Error("Invalid base58 character");
    }

    let carry = mapped;
    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index] * 58;
      bytes[index] = carry & 0xff;
      carry >>= 8;
    }

    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  let leadingZeroes = 0;
  for (const char of value) {
    if (char !== "1") break;
    leadingZeroes += 1;
  }

  return Uint8Array.from([
    ...new Array(leadingZeroes).fill(0),
    ...bytes.reverse(),
  ]);
}

function decodeSignedTransaction(value: string, encoding: "base64" | "base58") {
  if (encoding === "base58") return decodeBase58(value);
  return Uint8Array.from(Buffer.from(value, "base64"));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSignatureConfirmation(connection: Connection, signature: string) {
  for (let attempt = 0; attempt < CONFIRMATION_ATTEMPTS; attempt += 1) {
    const status = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: false,
    });
    const value = status.value[0];

    if (value?.err) {
      return {
        confirmed: false,
        failed: true,
        confirmationStatus: value.confirmationStatus ?? null,
      };
    }

    if (value?.confirmationStatus === "confirmed" || value?.confirmationStatus === "finalized") {
      return {
        confirmed: true,
        failed: false,
        confirmationStatus: value.confirmationStatus,
      };
    }

    if (attempt < CONFIRMATION_ATTEMPTS - 1) {
      await sleep(CONFIRMATION_INTERVAL_MS);
    }
  }

  return { confirmed: false, failed: false, confirmationStatus: null };
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
          "X-RateLimit-Limit": "20",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rateLimitCheck.resetAt),
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

  const parsedBody =
    parseResult.data && typeof parseResult.data === "object" && !Array.isArray(parseResult.data)
      ? (parseResult.data as Record<string, unknown>)
      : {};
  if (parsedBody.purpose === "fee_share_setup") {
    SafeLogger.warn("Blocked legacy fee-share setup broadcast attempt", {
      requestId,
      endpoint: ROUTE,
    });
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: "FEE_SHARE_SETUP_BROADCAST_BLOCKED",
          message:
            "Fee-share setup broadcasts are blocked to prevent partial SOL spend before a safe final launch transaction is available.",
        },
        meta: { requestId },
      },
      { status: 409 },
    );
  }

  const validation = validateLaunchpadInput(launchpadSendRequestSchema, parseResult.data);
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

  const input = ("data" in validation ? validation.data : {}) as {
    signedTransaction: string;
    encoding: "base64" | "base58";
    tokenMint?: string;
    mint?: string;
    wallet?: string;
    launchWallet?: string;
    purpose?: "launch";
  };

  if (isLaunchpadPublicWritesPaused()) {
    SafeLogger.warn("Launchpad send blocked by server-side Safety Gate", {
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
        meta: { requestId, publicWritesEnabled: false },
      },
      { status: 423 },
    );
  }

  const rpcUrl = getLaunchRpcUrl();
  if (!rpcUrl) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: "RPC_NOT_CONFIGURED",
          message: "Launchpad broadcast is unavailable because SOLANA_RPC_URL is not configured",
        },
        meta: { requestId },
      },
      { status: 503 },
    );
  }

  let rawTransaction: Uint8Array;
  try {
    rawTransaction = decodeSignedTransaction(
      input.signedTransaction,
      input.encoding,
    );
    if (rawTransaction.length === 0) throw new Error("Empty transaction");
  } catch {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "INVALID_TRANSACTION", message: "Signed transaction encoding is invalid" },
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  // Helpers para classificar erros RPC (TAREFA B)
  function classifyRpcError(err: unknown): {
    code: string;
    rpcCode?: number;
    rpcMessage?: string;
    upstreamStatus?: number;
    rawResponseHint?: string;
  } {
    const message = err instanceof Error ? err.message : String(err);
    const messageLower = message.toLowerCase();

    // Timeout / conexão
    if (
      messageLower.includes("timeout") ||
      messageLower.includes("econnrefused") ||
      messageLower.includes("enotfound") ||
      messageLower.includes("network") ||
      messageLower.includes("etimedout") ||
      messageLower.includes("socket")
    ) {
      return { code: "RPC_UNAVAILABLE", rpcMessage: "RPC endpoint is unreachable or timed out" };
    }

    // Saldo insuficiente
    if (
      messageLower.includes("insufficientfundsforrent") ||
      messageLower.includes("insufficient funds") ||
      messageLower.includes("insufficient lamports")
    ) {
      return { code: "INSUFFICIENT_FUNDS", rpcMessage: "Insufficient SOL balance for rent or fees" };
    }

    // Extrair código RPC JSON-RPC (-32xxx)
    const rpcCodeMatch = message.match(/-3\d{4}/);
    const rpcCode = rpcCodeMatch ? parseInt(rpcCodeMatch[0], 10) : undefined;

    // Extrair status HTTP upstream se presente no erro
    const httpStatusMatch = message.match(/\b(4\d{2}|5\d{2})\b/);
    const upstreamStatus = httpStatusMatch ? parseInt(httpStatusMatch[0], 10) : undefined;

    const rawHint = message.slice(0, 300).replace(/[A-Za-z0-9+/]{80,}/g, "[redacted-tx]");

    return {
      code: "SEND_FAILED",
      rpcCode,
      rpcMessage: message.slice(0, 200),
      upstreamStatus,
      rawResponseHint: rawHint,
    };
  }

  const txLengthBytes = rawTransaction.length;
  const sigPrefixForLog = rawTransaction.length >= 8
    ? Array.from(rawTransaction.slice(0, 4)).map(b => b.toString(16).padStart(2, "0")).join("")
    : "n/a";

  try {
    const connection = new Connection(rpcUrl, "confirmed");
    const signature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      maxRetries: 3,
    });

    const provenanceMint = input.tokenMint || input.mint;
    const provenanceWallet = input.wallet || input.launchWallet;
    let launchStatus: "submitted" | "confirmed" = "submitted";
    let confirmationStatus: string | null = null;
    if (provenanceMint) {
      const submittedPersisted = await updateUserLaunchSubmitted({
        mint: provenanceMint,
        wallet: provenanceWallet,
        txSignature: signature,
      });
      if (!submittedPersisted) {
        SafeLogger.warn("Launchpad submitted provenance was not persisted", {
          requestId,
          endpoint: ROUTE,
          tokenMint: provenanceMint,
          hasWallet: Boolean(provenanceWallet),
        });
      }
    }

    if (provenanceMint) {
      try {
        const confirmation = await waitForSignatureConfirmation(connection, signature);
        confirmationStatus = confirmation.confirmationStatus;

        if (confirmation.failed) {
          SafeLogger.warn("Launchpad transaction landed with an on-chain error", {
            requestId,
            endpoint: ROUTE,
            purpose: input.purpose || "launch",
            tokenMint: provenanceMint,
            signature,
            confirmationStatus,
          });
          return jsonResponse(
            req,
            requestId,
            {
              success: false,
              error: {
                code: "TRANSACTION_FAILED",
                message: "Launch transaction failed on-chain",
              },
              meta: { requestId, signature, confirmationStatus, elapsedMs: Date.now() - startTime },
            },
            { status: 502 },
          );
        }

        if (confirmation.confirmed && provenanceMint) {
          launchStatus = "confirmed";
          const confirmedPersisted = await updateUserLaunchConfirmed({
            mint: provenanceMint,
            wallet: provenanceWallet,
            txSignature: signature,
            confirmedAt: new Date().toISOString(),
          });
          if (!confirmedPersisted) {
            SafeLogger.warn("Launchpad confirmed provenance was not persisted", {
              requestId,
              endpoint: ROUTE,
              tokenMint: provenanceMint,
              hasWallet: Boolean(provenanceWallet),
            });
          }
        }
      } catch (confirmationError) {
        SafeLogger.warn("Launchpad confirmation polling failed; keeping submitted status", {
          requestId,
          endpoint: ROUTE,
          purpose: input.purpose || "launch",
          tokenMint: provenanceMint,
          error: confirmationError instanceof Error ? confirmationError.message : String(confirmationError),
        });
      }
    }

    return jsonResponse(
      req,
      requestId,
      {
        success: true,
        response: {
          signature,
          launchStatus,
          confirmationStatus,
          purpose: input.purpose || "launch",
        },
        meta: {
          requestId,
          signature,
          launchStatus,
          confirmationStatus,
          purpose: input.purpose || "launch",
          elapsedMs: Date.now() - startTime,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    const classified = classifyRpcError(error);

    // TAREFA B — log seguro: sem tx completa, sem key, sem seed
    SafeLogger.error("Launchpad signed transaction broadcast failed", error, {
      requestId,
      endpoint: ROUTE,
      purpose: input.purpose || "launch",
      txLengthBytes,
      txPrefixHex: sigPrefixForLog,
      elapsedMs,
      errorCode: classified.code,
      rpcCode: classified.rpcCode,
      upstreamStatus: classified.upstreamStatus,
    });

    const httpStatus =
      classified.code === "RPC_UNAVAILABLE" ? 503 :
      classified.code === "INSUFFICIENT_FUNDS" ? 402 :
      502;

    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: classified.code,
          message: classified.rpcMessage || "Failed to broadcast signed transaction",
          purpose: input.purpose || "launch",
          ...(classified.upstreamStatus !== undefined ? { upstreamStatus: classified.upstreamStatus } : {}),
          ...(classified.rpcCode !== undefined ? { rpcCode: classified.rpcCode } : {}),
          ...(classified.rpcMessage ? { rpcMessage: classified.rpcMessage.slice(0, 200) } : {}),
          ...(classified.rawResponseHint ? { rawResponseHint: classified.rawResponseHint } : {}),
        },
        meta: { requestId, elapsedMs },
      },
      { status: httpStatus },
    );
  }
}
