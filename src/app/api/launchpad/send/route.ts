/**
 * POST /api/launchpad/send
 *
 * Broadcasts a transaction already signed by the user's wallet. This route
 * never signs, never loads a private key, and never accepts unsigned payloads.
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection, VersionedTransaction, PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";
import { verifyToken } from "@/lib/auth/jwt";
import { getUserProfile } from "@/lib/auth/supabase";
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

// ── Relay safety guard ─────────────────────────────────────────────────────────
// /send is a thin broadcaster for user-signed launch/setup transactions. To avoid
// being abused as an open transaction relay, a transaction is broadcast only when
// it shows a STRONG link to a Bags Shield launch:
//   1) it invokes the Bags fee-share program, or the Meteora DBC program; or
//   2) it references the expected token mint (static keys or resolved LUT keys).
// Common programs (System/ComputeBudget/SPL Token/Token-2022/ATA) are NEVER
// sufficient on their own. Behaviour is controlled by LAUNCHPAD_RELAY_GUARD_MODE
// ("strict" = enforce, default; "observe" = log-only, never blocks).
const RELAY_STRONG_PROGRAM_IDS = new Set<string>([
  "FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK", // Bags fee-share / fee vault
  "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN",  // Meteora Dynamic Bonding Curve
]);

function getRelayGuardMode(): "strict" | "observe" {
  const v = (process.env.LAUNCHPAD_RELAY_GUARD_MODE || "").trim().toLowerCase();
  return v === "observe" ? "observe" : "strict";
}

type RelayVerdictCode =
  | "RELAY_TX_NOT_ALLOWED"
  | "RELAY_TX_LOOKUP_UNRESOLVED"
  | "RELAY_TX_INSPECTION_FAILED";

interface RelayVerdict {
  allowed: boolean;
  reason: string;
  code?: RelayVerdictCode;
}

function readMessageParts(message: unknown): {
  staticKeys: string[];
  programIds: string[];
  lutKeys: PublicKey[];
} {
  const msg = message as Record<string, unknown>;
  const isV0 = Array.isArray(msg.staticAccountKeys);
  const keysRaw = (isV0 ? msg.staticAccountKeys : msg.accountKeys) as
    | Array<{ toBase58?: () => string } | string>
    | undefined;
  const staticKeys = (keysRaw ?? []).map((k) =>
    typeof k === "string" ? k : k.toBase58?.() ?? String(k),
  );
  const ixs = (isV0 ? msg.compiledInstructions : msg.instructions) as
    | Array<{ programIdIndex: number }>
    | undefined;
  const programIds = (ixs ?? [])
    .map((ix) => staticKeys[ix.programIdIndex])
    .filter((value): value is string => Boolean(value));
  const lookups = (isV0 ? msg.addressTableLookups : []) as
    | Array<{ accountKey: PublicKey }>
    | undefined;
  const lutKeys = (lookups ?? []).map((l) => l.accountKey);
  return { staticKeys, programIds, lutKeys };
}

async function inspectRelayTransaction(
  rawTransaction: Uint8Array,
  expectedMint: string,
  rpcUrl: string,
): Promise<RelayVerdict> {
  let vtx: VersionedTransaction;
  try {
    vtx = VersionedTransaction.deserialize(rawTransaction);
  } catch {
    return { allowed: false, reason: "deserialize_failed", code: "RELAY_TX_INSPECTION_FAILED" };
  }

  let parts: ReturnType<typeof readMessageParts>;
  try {
    parts = readMessageParts(vtx.message);
  } catch {
    return { allowed: false, reason: "inspect_error", code: "RELAY_TX_INSPECTION_FAILED" };
  }

  const { staticKeys, programIds, lutKeys } = parts;

  // Strong signal: Bags fee-share or Meteora DBC program (program ids are static).
  if (programIds.some((p) => RELAY_STRONG_PROGRAM_IDS.has(p))) {
    return { allowed: true, reason: "strong_program" };
  }
  // Strong signal: expected mint referenced directly in static keys.
  if (staticKeys.includes(expectedMint)) {
    return { allowed: true, reason: "mint_in_static" };
  }
  // No strong signal in static keys and no lookup tables to resolve -> reject.
  if (lutKeys.length === 0) {
    return { allowed: false, reason: "no_strong_signal", code: "RELAY_TX_NOT_ALLOWED" };
  }

  // Resolve address lookup tables and search the loaded keys for the expected mint.
  try {
    const connection = new Connection(rpcUrl, "confirmed");
    for (const tableKey of lutKeys) {
      const table = await connection.getAddressLookupTable(tableKey);
      if (!table?.value) {
        return { allowed: false, reason: "lut_unresolved", code: "RELAY_TX_LOOKUP_UNRESOLVED" };
      }
      if (table.value.state.addresses.some((addr) => addr.toBase58() === expectedMint)) {
        return { allowed: true, reason: "mint_in_lut" };
      }
    }
    return { allowed: false, reason: "no_strong_signal_after_lut", code: "RELAY_TX_NOT_ALLOWED" };
  } catch {
    return { allowed: false, reason: "lut_resolve_error", code: "RELAY_TX_LOOKUP_UNRESOLVED" };
  }
}

// ── Required-signer extraction (legacy + v0) ───────────────────────────────────
function extractRequiredSigners(rawTransaction: Uint8Array): string[] | null {
  try {
    const vtx = VersionedTransaction.deserialize(rawTransaction);
    const msg = vtx.message as unknown as Record<string, unknown>;
    const isV0 = Array.isArray(msg.staticAccountKeys);
    const keysRaw = (isV0 ? msg.staticAccountKeys : msg.accountKeys) as
      | Array<{ toBase58?: () => string } | string>
      | undefined;
    const keys = (keysRaw ?? []).map((k) =>
      typeof k === "string" ? k : k.toBase58?.() ?? String(k),
    );
    const header = msg.header as { numRequiredSignatures?: number } | undefined;
    const n = header?.numRequiredSignatures ?? 0;
    if (n <= 0) return [];
    return keys.slice(0, n);
  } catch {
    return null;
  }
}

// ── In-memory recent-broadcast cache (anti double-click / replay) ───────────────
// Keyed by sha256(signedTransaction). Re-sending the EXACT same signed tx within
// the TTL is idempotent (same on-chain signature), so we return the cached result
// instead of hitting the RPC again. A legitimate retry produces a different signed
// tx (new blockhash) and is NOT treated as a duplicate.
interface RecentBroadcastEntry {
  response: Record<string, unknown>;
  meta: Record<string, unknown>;
  ts: number;
}
const RECENT_BROADCAST_TTL_MS = 120_000;
const recentBroadcasts = new Map<string, RecentBroadcastEntry>();

function getRecentBroadcast(key: string): RecentBroadcastEntry | null {
  const now = Date.now();
  const entry = recentBroadcasts.get(key);
  if (entry && now - entry.ts < RECENT_BROADCAST_TTL_MS) return entry;
  if (entry) recentBroadcasts.delete(key);
  if (recentBroadcasts.size > 500) {
    for (const [k, v] of recentBroadcasts) {
      if (now - v.ts >= RECENT_BROADCAST_TTL_MS) recentBroadcasts.delete(k);
    }
  }
  return null;
}

function setRecentBroadcast(
  key: string,
  value: { response: Record<string, unknown>; meta: Record<string, unknown> },
): void {
  recentBroadcasts.set(key, { ...value, ts: Date.now() });
}

// ── Linked-wallet account check ────────────────────────────────────────────────
// The launch wallet must belong to the authenticated Bags Shield account (any of
// the user's verified linked wallets). Enabled by LAUNCHPAD_REQUIRE_LINKED_WALLET
// (default false for internal/test; set true for public). When enabled it is
// fail-closed: no/invalid session, or a wallet not in the account, is rejected.
function requireLinkedWallet(): boolean {
  const v = (process.env.LAUNCHPAD_REQUIRE_LINKED_WALLET || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

async function resolveLinkedWalletAccess(
  req: NextRequest,
  expectedWallet: string,
): Promise<{ ok: boolean; reason: string; userId?: string }> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, reason: "no_session" };
  let payload: { userId: string } | null;
  try {
    payload = await verifyToken(token);
  } catch {
    return { ok: false, reason: "session_verify_error" };
  }
  if (!payload?.userId) return { ok: false, reason: "invalid_session" };
  let profile: Awaited<ReturnType<typeof getUserProfile>> = null;
  try {
    profile = await getUserProfile(payload.userId);
  } catch {
    return { ok: false, reason: "profile_lookup_error", userId: payload.userId };
  }
  if (!profile) return { ok: false, reason: "profile_not_found", userId: payload.userId };
  const linked = profile.wallets.includes(expectedWallet);
  return { ok: linked, reason: linked ? "linked" : "wallet_not_linked", userId: payload.userId };
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
    stage?: "config_setup" | "launch_final";
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

  const expectedMint = input.tokenMint || input.mint;
  const relayGuardMode = getRelayGuardMode();

  if (!expectedMint) {
    SafeLogger.warn("Launchpad send missing expected mint", {
      requestId,
      endpoint: ROUTE,
      mode: relayGuardMode,
      wallet: input.wallet || input.launchWallet,
    });
    if (relayGuardMode === "strict") {
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "MISSING_EXPECTED_MINT",
            message: "tokenMint or mint is required to broadcast a launch transaction.",
          },
          meta: { requestId },
        },
        { status: 400 },
      );
    }
  } else {
    const relayVerdict = await inspectRelayTransaction(rawTransaction, expectedMint, rpcUrl);
    if (!relayVerdict.allowed) {
      SafeLogger.warn("Launchpad send relay guard verdict", {
        requestId,
        endpoint: ROUTE,
        mode: relayGuardMode,
        reason: relayVerdict.reason,
        verdictCode: relayVerdict.code,
        mint: expectedMint,
        wallet: input.wallet || input.launchWallet,
        txLengthBytes: rawTransaction.length,
      });
      if (relayGuardMode === "strict") {
        const code = relayVerdict.code ?? "RELAY_TX_NOT_ALLOWED";
        const message =
          code === "RELAY_TX_LOOKUP_UNRESOLVED"
            ? "Could not resolve the transaction's address lookup tables to verify the launch mint."
            : code === "RELAY_TX_INSPECTION_FAILED"
              ? "The transaction could not be inspected for launch safety."
              : "This endpoint only broadcasts Bags Shield launch transactions.";
        return jsonResponse(
          req,
          requestId,
          {
            success: false,
            error: { code, message },
            meta: { requestId },
          },
          { status: 422 },
        );
      }
    }
  }

  const expectedWallet = input.wallet || input.launchWallet;
  const broadcastStage: "config_setup" | "launch_final" =
    input.stage === "config_setup" ? "config_setup" : "launch_final";

  if (!expectedWallet) {
    SafeLogger.warn("Launchpad send missing expected wallet", {
      requestId,
      endpoint: ROUTE,
      mode: relayGuardMode,
      stage: broadcastStage,
      mint: expectedMint,
      txLengthBytes: rawTransaction.length,
    });
    if (relayGuardMode === "strict") {
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "MISSING_EXPECTED_WALLET",
            message: "wallet or launchWallet is required to broadcast a launch transaction.",
          },
          meta: { requestId },
        },
        { status: 400 },
      );
    }
  } else {
    const requiredSigners = extractRequiredSigners(rawTransaction);
    if (requiredSigners === null) {
      SafeLogger.warn("Launchpad send could not extract required signers", {
        requestId,
        endpoint: ROUTE,
        mode: relayGuardMode,
        stage: broadcastStage,
        mint: expectedMint,
        wallet: expectedWallet,
        txLengthBytes: rawTransaction.length,
        reason: "signer_inspection_failed",
      });
      if (relayGuardMode === "strict") {
        return jsonResponse(
          req,
          requestId,
          {
            success: false,
            error: {
              code: "RELAY_TX_INSPECTION_FAILED",
              message: "The transaction could not be inspected for the expected signer.",
            },
            meta: { requestId },
          },
          { status: 422 },
        );
      }
    } else if (!requiredSigners.includes(expectedWallet)) {
      SafeLogger.warn("Launchpad send expected wallet is not a required signer", {
        requestId,
        endpoint: ROUTE,
        mode: relayGuardMode,
        stage: broadcastStage,
        mint: expectedMint,
        wallet: expectedWallet,
        txLengthBytes: rawTransaction.length,
        reason: "signer_mismatch",
      });
      if (relayGuardMode === "strict") {
        return jsonResponse(
          req,
          requestId,
          {
            success: false,
            error: {
              code: "RELAY_TX_SIGNER_MISMATCH",
              message: "The expected wallet is not a required signer of this transaction.",
            },
            meta: { requestId },
          },
          { status: 422 },
        );
      }
    }
  }

  if (expectedWallet && requireLinkedWallet()) {
    const access = await resolveLinkedWalletAccess(req, expectedWallet);
    const userIdPartial = access.userId ? `${access.userId.slice(0, 8)}…` : null;
    if (!access.ok) {
      SafeLogger.warn("Launchpad send wallet not linked to authenticated account", {
        requestId,
        endpoint: ROUTE,
        mode: relayGuardMode,
        stage: broadcastStage,
        mint: expectedMint,
        wallet: expectedWallet,
        userIdPartial,
        reason: access.reason,
        txLengthBytes: rawTransaction.length,
      });
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "WALLET_NOT_LINKED_TO_ACCOUNT",
            message:
              "The launch wallet must be linked and verified on your Bags Shield account before broadcasting.",
          },
          meta: { requestId },
        },
        { status: 403 },
      );
    }
    SafeLogger.info("Launchpad send linked-wallet check passed", {
      requestId,
      endpoint: ROUTE,
      stage: broadcastStage,
      mint: expectedMint,
      wallet: expectedWallet,
      userIdPartial,
    });
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

  const txFingerprint = createHash("sha256").update(rawTransaction).digest("hex");
  const cachedBroadcast = getRecentBroadcast(txFingerprint);
  if (cachedBroadcast) {
    SafeLogger.warn("Launchpad send duplicate broadcast detected; returning cached result", {
      requestId,
      endpoint: ROUTE,
      mode: relayGuardMode,
      stage: broadcastStage,
      mint: expectedMint,
      wallet: expectedWallet,
      txLengthBytes,
      reason: "duplicate_broadcast",
    });
    return jsonResponse(
      req,
      requestId,
      {
        success: true,
        response: { ...cachedBroadcast.response, duplicate: true },
        meta: { requestId, ...cachedBroadcast.meta, duplicate: true, elapsedMs: Date.now() - startTime },
      },
      { status: 200 },
    );
  }

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
    if (provenanceMint && broadcastStage !== "config_setup") {
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

        if (confirmation.confirmed && provenanceMint && broadcastStage !== "config_setup") {
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

    const successResponse = {
      signature,
      launchStatus,
      confirmationStatus,
      purpose: input.purpose || "launch",
      stage: broadcastStage,
    };
    const successMeta = {
      signature,
      launchStatus,
      confirmationStatus,
      purpose: input.purpose || "launch",
      stage: broadcastStage,
    };
    setRecentBroadcast(txFingerprint, { response: successResponse, meta: successMeta });

    return jsonResponse(
      req,
      requestId,
      {
        success: true,
        response: successResponse,
        meta: { requestId, ...successMeta, elapsedMs: Date.now() - startTime },
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
