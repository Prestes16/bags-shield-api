import { NextRequest, NextResponse } from "next/server";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  getOrGenerateRequestId,
  safeJsonParse,
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
  SafeLogger,
} from "@/lib/security";
import { handlePreflight } from "@/lib/security/cors";
import { getClaimTransactionsV3 } from "@/lib/launchpad/bags-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/launchpad/fee-claims/transactions";
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_MAP = new Map(BASE58_ALPHABET.split("").map((char, index) => [char, index]));

function isValidPublicKey(value: string) {
  try {
    new PublicKey(value);
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
  } catch {
    return false;
  }
}

function jsonResponse(req: NextRequest, requestId: string, body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set("X-Request-Id", requestId);
  return res;
}

function decodeBase58(value: string): Uint8Array {
  const bytes = [0];

  for (const char of value) {
    const mapped = BASE58_MAP.get(char);
    if (mapped === undefined) throw new Error("Invalid base58 character");

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

  return Uint8Array.from([...new Array(leadingZeroes).fill(0), ...bytes.reverse()]);
}

function assertSolanaTransaction(bytes: Uint8Array) {
  try {
    VersionedTransaction.deserialize(bytes);
    return;
  } catch {}

  try {
    Transaction.from(Buffer.from(bytes));
    return;
  } catch {
    throw new Error("Invalid serialized transaction");
  }
}

function normalizeTransactionEncoding(serialized: string) {
  const attempts: Array<() => Uint8Array> = [
    () => decodeBase58(serialized),
    () => Uint8Array.from(Buffer.from(serialized, "base64")),
  ];

  for (const attempt of attempts) {
    try {
      const bytes = attempt();
      if (bytes.length === 0) continue;
      assertSolanaTransaction(bytes);
      return {
        transaction: Buffer.from(bytes).toString("base64"),
        encoding: "base64" as const,
      };
    } catch {}
  }

  throw new Error("Bags returned an invalid claim transaction");
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ["POST"]);
}

export async function POST(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);
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

  const bodyText = await req.text();
  const parsed = safeJsonParse<unknown>(bodyText);
  if (!parsed.success || !parsed.data || typeof parsed.data !== "object") {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "BAD_REQUEST", message: parsed.error || "Invalid JSON" },
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  const data = parsed.data as Record<string, unknown>;
  const feeClaimer = String(data.feeClaimer ?? data.wallet ?? "").trim();
  const tokenMint = String(data.tokenMint ?? data.mint ?? "").trim();

  if (!feeClaimer || !isValidPublicKey(feeClaimer)) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "INVALID_FEE_CLAIMER", message: "feeClaimer must be a valid Solana public key" },
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  if (!tokenMint || !isValidPublicKey(tokenMint)) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "INVALID_TOKEN_MINT", message: "tokenMint must be a valid Solana public key" },
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  const result = await getClaimTransactionsV3({ feeClaimer, tokenMint });

  if ("error" in result) {
    SafeLogger.error("Bags claim transaction request failed", undefined, {
      requestId,
      endpoint: ROUTE,
      errorCode: result.error.code,
      feeClaimer,
      tokenMint,
    });

    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: result.error.code, message: result.error.message },
        meta: { requestId, upstream: "bags" },
      },
      { status: result.error.code === "BAGS_NOT_CONFIGURED" ? 503 : 502 },
    );
  }

  let transactions: Array<Record<string, unknown>>;
  try {
    transactions = (result.response ?? []).map((item, index) => {
      if (!item?.tx || typeof item.tx !== "string") {
        throw new Error(`Claim transaction ${index + 1} is missing tx`);
      }

      return {
        ...normalizeTransactionEncoding(item.tx),
        blockhash: item.blockhash,
      };
    });
  } catch (error) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: "INVALID_UPSTREAM_TRANSACTION",
          message: error instanceof Error ? error.message : "Invalid claim transaction returned by Bags",
        },
        meta: { requestId, upstream: "bags" },
      },
      { status: 502 },
    );
  }

  return jsonResponse(req, requestId, {
    success: true,
    response: {
      feeClaimer,
      tokenMint,
      transactions,
    },
    meta: { requestId, upstream: "bags" },
  });
}
