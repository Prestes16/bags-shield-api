/**
 * Scanner paywall - per-account daily free quota + paid extra scans.
 *
 * Model (no plans, no subscriptions): N free scans per UTC day per Bags Shield
 * userId; after that, each extra scan needs an individual micro-payment to the
 * treasury, signed by a wallet LINKED to the account and verified on-chain.
 *
 * Backend is the source of truth. Quota is atomic (Postgres claim_free_scan).
 * Never trusts the client for price, wallet, quota, or ownership. Logs are safe
 * (no JWT, no secrets, no full transactions).
 */

import { NextRequest } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { verifyToken } from "@/lib/auth/jwt";
import { getUserProfile } from "@/lib/auth/supabase";
import { getSupabaseRest } from "@/lib/launchpad/launch-registry";
import { getHeliusRpcUrl } from "@/lib/helius";

const DEFAULT_TREASURY = "7ZybPucnSryE5BydcARdc4Q2gz1SaospMVRyQ2LCeyRi";
const DEFAULT_PAID_FEE_LAMPORTS = 1_000_000; // 0.001 SOL (product decision)
const INTENT_TTL_MS = 10 * 60 * 1000; // 10 min
const MEMO_PROGRAM_IDS = new Set([
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo",
]);

function envBool(name: string, dflt: boolean): boolean {
  const v = (process.env[name] || "").trim().toLowerCase();
  if (!v) return dflt;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
function envInt(name: string, dflt: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : dflt;
}
function envNum(name: string): number | null {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function scanPaywallEnabled(): boolean {
  return envBool("SCAN_PAYWALL_ENABLED", true);
}
export function freeDailyLimit(): number {
  return envInt("SCAN_FREE_DAILY_LIMIT", 3);
}
export function scanTreasuryWallet(): string {
  return (process.env.SCAN_TREASURY_WALLET || DEFAULT_TREASURY).trim();
}

/**
 * Final price for one extra scan.
 *   1) SCAN_PAID_SCAN_FEE_LAMPORTS override wins (no live SOL price dependency).
 *   2) else the cost formula, when all inputs are configured.
 *   3) else the product default (0.001 SOL).
 * The critical scan path never fetches a live SOL price.
 */
export function paidScanFeeLamports(): number {
  const override = Number(process.env.SCAN_PAID_SCAN_FEE_LAMPORTS);
  if (Number.isFinite(override) && override > 0) return Math.floor(override);

  const provider = envNum("SCAN_PROVIDER_COST_USD_PER_SCAN");
  const infra = envNum("SCAN_INFRA_COST_USD_PER_SCAN");
  const solUsd = envNum("SCAN_SOL_USD_REFERENCE");
  if (provider != null && infra != null && solUsd != null) {
    const bufferBps = envInt("SCAN_PRICE_BUFFER_BPS", 1000);
    const usd = (provider + infra) * (1 + bufferBps / 10000);
    return Math.ceil((usd / solUsd) * 1_000_000_000);
  }
  return DEFAULT_PAID_FEE_LAMPORTS;
}

/** Public, non-sensitive paywall config for /api/status. */
export function publicScanPaywallStatus() {
  return {
    scanPaywallEnabled: scanPaywallEnabled(),
    freeDailyLimit: freeDailyLimit(),
    paidScanFeeLamports: paidScanFeeLamports(),
    scanTreasuryWallet: scanTreasuryWallet(),
  };
}

/** Seconds until the next UTC midnight (free-quota reset). */
export function secondsUntilUtcReset(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

/** Resolve the authenticated Bags Shield userId from the Bearer JWT, or null. */
export async function resolveScanUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const payload = await verifyToken(token);
    return payload?.userId ?? null;
  } catch {
    return null;
  }
}

/**
 * Atomically claim one free scan for today. Returns the 1-based sequence used,
 * or -1 when the daily free limit is already reached.
 */
export async function claimFreeScan(userId: string, mint: string | null): Promise<number> {
  const sb = getSupabaseRest();
  if (!sb) return -1; // fail-closed: no DB, no free quota tracking, treat as exhausted
  try {
    const res = await fetch(`${sb.base}/rpc/claim_free_scan`, {
      method: "POST",
      headers: { ...sb.headers, prefer: "return=representation" },
      body: JSON.stringify({ p_user_id: userId, p_mint: mint, p_limit: freeDailyLimit() }),
      cache: "no-store",
    });
    if (!res.ok) return -1;
    const value = await res.json();
    const seq = typeof value === "number" ? value : Number(value);
    return Number.isFinite(seq) ? seq : -1;
  } catch {
    return -1;
  }
}

/** Count today's free scans (UTC) for display/402. Best-effort. */
export async function countFreeScansToday(userId: string): Promise<number> {
  const sb = getSupabaseRest();
  if (!sb) return freeDailyLimit();
  try {
    const day = new Date().toISOString().slice(0, 10);
    const res = await fetch(
      `${sb.base}/scan_usage_ledger?user_id=eq.${userId}&kind=eq.free_scan&scan_date=eq.${day}&select=id`,
      { headers: { ...sb.headers, prefer: "count=exact" }, cache: "no-store" },
    );
    const range = res.headers.get("content-range");
    if (range && range.includes("/")) {
      const total = Number(range.split("/")[1]);
      if (Number.isFinite(total)) return total;
    }
    const rows = (await res.json()) as unknown[];
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

/** Body returned with HTTP 402 when the free quota is exhausted. */
export function build402Body(freeUsedToday: number, requestId: string) {
  return {
    success: false as const,
    paywall: true as const,
    reason: "FREE_DAILY_LIMIT_REACHED" as const,
    freeLimit: freeDailyLimit(),
    freeUsedToday,
    resetAfter: secondsUntilUtcReset(),
    paidScanFeeLamports: paidScanFeeLamports(),
    treasuryWallet: scanTreasuryWallet(),
    paymentQuoteEndpoint: "/api/scan/payment/quote",
    paymentVerifyEndpoint: "/api/scan/payment/verify",
    meta: { requestId },
  };
}

interface PaymentIntent {
  id: number;
  user_id: string;
  mint: string | null;
  price_lamports: number;
  treasury_wallet: string;
  reference: string;
  status: string;
  signature: string | null;
  expires_at: string;
}

function randomReference(): string {
  const bytes = new Uint8Array(18);
  globalThis.crypto.getRandomValues(bytes);
  let out = "bsscan_";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/** Create a single-scan payment intent. */
export async function createPaymentIntent(userId: string, mint: string | null) {
  const sb = getSupabaseRest();
  if (!sb) throw new Error("DB unavailable");
  const reference = randomReference();
  const price = paidScanFeeLamports();
  const treasury = scanTreasuryWallet();
  const expiresAt = new Date(Date.now() + INTENT_TTL_MS).toISOString();

  const res = await fetch(`${sb.base}/scan_payment_intents`, {
    method: "POST",
    headers: { ...sb.headers, prefer: "return=representation" },
    body: JSON.stringify({
      user_id: userId,
      mint,
      price_lamports: price,
      treasury_wallet: treasury,
      reference,
      status: "pending",
      expires_at: expiresAt,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("intent_create_failed");
  const rows = (await res.json()) as PaymentIntent[];
  const row = Array.isArray(rows) ? rows[0] : (rows as unknown as PaymentIntent);
  return {
    reference: row.reference,
    priceLamports: row.price_lamports,
    treasuryWallet: row.treasury_wallet,
    expiresAt: row.expires_at,
  };
}

type VerifyResult = { ok: true } | { ok: false; code: string; message: string };

/**
 * Verify a payment on-chain and mark the matching intent as paid.
 * Checks: intent exists for this user + reference, not expired, still pending;
 * tx confirmed with no error; a SystemProgram transfer to the treasury for at
 * least the quoted price; payer is a wallet linked to the account; the memo
 * carries the reference; the signature has not been used before.
 */
export async function verifyScanPayment(
  userId: string,
  signature: string,
  reference: string,
): Promise<VerifyResult> {
  const sb = getSupabaseRest();
  if (!sb) return { ok: false, code: "DB_UNAVAILABLE", message: "Service unavailable" };

  // 1) Load the intent (by unique reference) scoped to this user.
  let intent: PaymentIntent | null = null;
  try {
    const res = await fetch(
      `${sb.base}/scan_payment_intents?reference=eq.${encodeURIComponent(reference)}&user_id=eq.${userId}&select=*&limit=1`,
      { headers: sb.headers, cache: "no-store" },
    );
    const rows = (await res.json()) as PaymentIntent[];
    intent = Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch {
    return { ok: false, code: "INTENT_LOOKUP_FAILED", message: "Could not load payment" };
  }
  if (!intent) return { ok: false, code: "INTENT_NOT_FOUND", message: "Payment quote not found" };
  if (intent.status === "used") return { ok: false, code: "ALREADY_USED", message: "Payment already used" };
  if (intent.status !== "pending" && intent.status !== "paid") {
    return { ok: false, code: "INTENT_INVALID", message: "Payment quote is not payable" };
  }
  if (new Date(intent.expires_at).getTime() < Date.now()) {
    return { ok: false, code: "QUOTE_EXPIRED", message: "Payment quote expired" };
  }

  // 2) Payer must be one of the account's linked wallets.
  let linked: Set<string>;
  try {
    const profile = await getUserProfile(userId);
    linked = new Set((profile?.wallets ?? []).map((w) => String(w).trim()).filter(Boolean));
  } catch {
    return { ok: false, code: "PROFILE_LOOKUP_FAILED", message: "Could not verify account wallets" };
  }
  if (linked.size === 0) {
    return { ok: false, code: "NO_LINKED_WALLET", message: "Link a wallet to your account first" };
  }

  // 3) On-chain verification.
  const rpc = getHeliusRpcUrl();
  if (!rpc) return { ok: false, code: "RPC_UNAVAILABLE", message: "Verification unavailable" };
  let parsed;
  try {
    const connection = new Connection(rpc, "confirmed");
    parsed = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
  } catch {
    return { ok: false, code: "TX_FETCH_FAILED", message: "Could not fetch transaction" };
  }
  if (!parsed || parsed.meta?.err) {
    return { ok: false, code: "TX_NOT_CONFIRMED", message: "Transaction not confirmed" };
  }

  const treasury = scanTreasuryWallet();
  const minLamports = intent.price_lamports;
  const instructions = parsed.transaction.message.instructions as unknown as Array<Record<string, unknown>>;

  let transferOk = false;
  let memoOk = false;
  for (const ix of instructions) {
    const program = ix.program as string | undefined;
    const programId = ix.programId ? String(ix.programId) : "";
    const parsedIx = ix.parsed as { type?: string; info?: Record<string, unknown> } | string | undefined;

    if (program === "system" && parsedIx && typeof parsedIx === "object" && parsedIx.type === "transfer") {
      const info = parsedIx.info ?? {};
      const dest = String(info.destination ?? "");
      const source = String(info.source ?? "");
      const lamports = Number(info.lamports ?? 0);
      if (dest === treasury && lamports >= minLamports && linked.has(source)) {
        transferOk = true;
      }
    }
    if (program === "spl-memo" || MEMO_PROGRAM_IDS.has(programId)) {
      const memo = typeof parsedIx === "string" ? parsedIx : String((ix as { parsed?: unknown }).parsed ?? "");
      if (memo.includes(reference)) memoOk = true;
    }
  }

  if (!transferOk) {
    return { ok: false, code: "TRANSFER_INVALID", message: "No valid payment to the treasury was found" };
  }
  if (!memoOk) {
    return { ok: false, code: "MEMO_MISMATCH", message: "Payment reference does not match" };
  }

  // 4) Atomically mark the intent paid (status pending->paid). The unique
  // signature column rejects re-using the same signature for another intent.
  try {
    const res = await fetch(
      `${sb.base}/scan_payment_intents?id=eq.${intent.id}&status=eq.pending`,
      {
        method: "PATCH",
        headers: { ...sb.headers, prefer: "return=representation" },
        body: JSON.stringify({ status: "paid", signature }),
        cache: "no-store",
      },
    );
    const rows = (await res.json()) as PaymentIntent[];
    if (!Array.isArray(rows) || rows.length === 0) {
      // Either already paid by a concurrent verify, or signature unique conflict.
      if (intent.status === "paid" && intent.signature === signature) return { ok: true };
      return { ok: false, code: "MARK_PAID_FAILED", message: "Could not finalize payment" };
    }
  } catch {
    return { ok: false, code: "MARK_PAID_FAILED", message: "Could not finalize payment" };
  }

  return { ok: true };
}

/**
 * Consume one already-paid intent for (userId, mint) - flips paid->used
 * atomically and records the paid_scan in the ledger. Returns true when a paid
 * scan was granted, false when none is available.
 */
export async function consumePaidScan(userId: string, mint: string | null): Promise<boolean> {
  const sb = getSupabaseRest();
  if (!sb) return false;
  // Atomic: pick one paid intent, flip paid->used, and insert the paid_scan
  // ledger row in a single Postgres transaction (consume_paid_scan RPC). No scan
  // is ever granted without an audit ledger row.
  try {
    const res = await fetch(`${sb.base}/rpc/consume_paid_scan`, {
      method: "POST",
      headers: { ...sb.headers, prefer: "return=representation" },
      body: JSON.stringify({ p_user_id: userId, p_mint: mint }),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const value = await res.json();
    return value === true;
  } catch {
    return false;
  }
}
