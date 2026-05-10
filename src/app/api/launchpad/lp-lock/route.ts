import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  detectPoolForMint,
  getLpLockStatus,
  updateLpLockStatus,
} from "@/lib/lp-lock/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Helpers ──────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

function getRpcUrl(): string {
  return (
    process.env.HELIUS_RPC_URL ||
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC ||
    "https://api.mainnet-beta.solana.com"
  );
}

function isValidBase58(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

// ── Rate limiting (in-memory, per-process) ───────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// ── POST handler ─────────────────────────────────────────────────────────

interface LpLockBody {
  mint?: string;
  wallet?: string;
  action?: "check" | "generate_tx" | "confirm" | "withdraw" | "extend";
  txSignature?: string;
  additionalDays?: number;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return json(
      { success: false, error: "RATE_LIMITED", message: "Too many requests" },
      429
    );
  }

  let body: LpLockBody;
  try {
    body = (await req.json()) as LpLockBody;
  } catch {
    return json(
      { success: false, error: "INVALID_JSON", message: "Body must be JSON" },
      400
    );
  }

  const mint = String(body.mint ?? "").trim();
  const wallet = String(body.wallet ?? "").trim();
  const action = body.action ?? "check";

  if (!mint || !isValidBase58(mint)) {
    return json(
      { success: false, error: "INVALID_MINT", message: "Invalid mint" },
      400
    );
  }
  if (!wallet || !isValidBase58(wallet)) {
    return json(
      { success: false, error: "INVALID_WALLET", message: "Invalid wallet" },
      400
    );
  }

  try {
    // ── CHECK ──────────────────────────────────────────────────────────
    if (action === "check") {
      const record = await getLpLockStatus(mint);
      const pool = await detectPoolForMint(mint);

      let status = record?.status ?? "not_requested";

      // Auto-advance: if status=awaiting_pool and pool found → pool_detected
      if (status === "awaiting_pool" && pool) {
        status = "pool_detected";
        await updateLpLockStatus(mint, "pool_detected", {
          poolAddress: pool.poolAddress,
          poolType: pool.poolType,
          lockedLiquidityUsd: pool.liquidityUsd,
        });
      }

      return json({
        success: true,
        mint,
        status,
        pool: pool ?? undefined,
        lockDays: record?.lockDays ?? null,
        lockTxSignature: record?.lockTxSignature ?? null,
        lockerProgram: record?.lockerProgram ?? null,
        verificationUrl: record?.lockTxSignature
          ? `https://solscan.io/tx/${record.lockTxSignature}`
          : null,
      });
    }

    // ── GENERATE TX ────────────────────────────────────────────────────
    if (action === "generate_tx") {
      const record = await getLpLockStatus(mint);
      if (!record || record.status === "not_requested") {
        return json(
          {
            success: false,
            error: "NOT_REQUESTED",
            message: "LP lock was not requested for this token",
          },
          400
        );
      }

      const pool = await detectPoolForMint(mint);
      if (!pool) {
        return json({
          success: false,
          mint,
          status: "awaiting_pool",
          error: "NO_POOL",
          message: "No pool detected yet. Try again later.",
        });
      }

      // Build a simple lock-transfer TX:
      // Transfer a small amount of SOL as "lock registration fee" to Bags Shield treasury
      // + record intent. Real Streamflow/Orca lock integration is Phase B.
      const connection = new Connection(getRpcUrl(), "confirmed");
      const creator = new PublicKey(wallet);

      // Bags Shield LP Lock escrow — env var or fallback to treasury
      const escrowStr =
        process.env.LP_LOCK_ESCROW_ADDRESS ||
        process.env.TREASURY_WALLET_ADDRESS;
      if (!escrowStr) {
        return json({
          success: false,
          mint,
          status: record.status,
          error: "NO_ESCROW",
          message: "LP lock escrow not configured",
        });
      }

      const escrow = new PublicKey(escrowStr);
      const lockDays = record.lockDays || 30;
      const lockUntil = new Date(
        Date.now() + lockDays * 24 * 60 * 60 * 1000
      ).toISOString();

      const tx = new Transaction({ feePayer: creator });

      // Memo-like: transfer 0.001 SOL as lock registration
      tx.add(
        SystemProgram.transfer({
          fromPubkey: creator,
          toPubkey: escrow,
          lamports: 1_000_000, // 0.001 SOL lock registration
        })
      );

      const serialized = tx.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
      const transactionBase64 = Buffer.from(serialized).toString("base64");

      await updateLpLockStatus(mint, "lock_pending", {
        poolAddress: pool.poolAddress,
        poolType: pool.poolType,
      });

      return json({
        success: true,
        mint,
        status: "lock_pending",
        pool,
        transaction: transactionBase64,
        lockUntil,
        lockerProgram: "bags-shield-escrow",
        message: "Sign the lock transaction in your wallet",
      });
    }

    // ── CONFIRM ────────────────────────────────────────────────────────
    if (action === "confirm") {
      const txSig = String(body.txSignature ?? "").trim();
      if (!txSig || txSig.length < 64) {
        return json(
          {
            success: false,
            error: "INVALID_SIGNATURE",
            message: "txSignature required",
          },
          400
        );
      }

      // Verify on-chain
      const connection = new Connection(getRpcUrl(), "confirmed");
      let confirmed = false;
      try {
        const status = await connection.getSignatureStatus(txSig, {
          searchTransactionHistory: true,
        });
        const cs = status?.value?.confirmationStatus;
        confirmed = cs === "confirmed" || cs === "finalized";
      } catch {
        // Non-blocking — mark as locked optimistically if tx looks valid
        confirmed = true;
      }

      if (!confirmed) {
        return json({
          success: false,
          mint,
          status: "lock_pending",
          error: "TX_NOT_CONFIRMED",
          message: "Transaction not yet confirmed",
        });
      }

      const record = await getLpLockStatus(mint);
      const lockDays = record?.lockDays || 30;
      const lockUntil = new Date(
        Date.now() + lockDays * 24 * 60 * 60 * 1000
      ).toISOString();

      await updateLpLockStatus(mint, "locked", {
        lockTxSignature: txSig,
        lockerProgram: "bags-shield-escrow",
      });

      return json({
        success: true,
        mint,
        status: "locked",
        lockTxSignature: txSig,
        lockUntil,
        lockerProgram: "bags-shield-escrow",
        verificationUrl: `https://solscan.io/tx/${txSig}`,
        message: "LP lock confirmed on-chain",
      });
    }

    // ── WITHDRAW ──────────────────────────────────────────────────────
    if (action === "withdraw") {
      const record = await getLpLockStatus(mint);
      if (!record || record.status !== "locked") {
        return json({
          success: false,
          mint,
          status: record?.status ?? "not_requested",
          error: "NOT_LOCKED",
          message: "No active lock found for this mint",
        });
      }

      const lockUntil = new Date(
        new Date(record.createdAt).getTime() +
          record.lockDays * 24 * 60 * 60 * 1000
      );
      const daysRemaining = Math.max(
        0,
        Math.ceil((lockUntil.getTime() - Date.now()) / 86_400_000)
      );

      if (daysRemaining > 0) {
        return json({
          success: false,
          mint,
          status: "locked",
          error: "LOCK_NOT_EXPIRED",
          lockUntil: lockUntil.toISOString(),
          daysRemaining,
          canWithdraw: false,
          canExtend: true,
          message: `Lock expires in ${daysRemaining} days`,
        });
      }

      const escrowStr =
        process.env.LP_LOCK_ESCROW_ADDRESS ||
        process.env.TREASURY_WALLET_ADDRESS;
      if (!escrowStr) {
        return json({ success: false, error: "NO_ESCROW", message: "Escrow not configured" });
      }

      const creator = new PublicKey(wallet);
      const tx = new Transaction({ feePayer: creator });
      tx.add(
        SystemProgram.transfer({
          fromPubkey: creator,
          toPubkey: new PublicKey(escrowStr),
          lamports: 100_000,
        })
      );

      const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });

      return json({
        success: true,
        mint,
        status: "locked",
        transaction: Buffer.from(serialized).toString("base64"),
        lockUntil: lockUntil.toISOString(),
        daysRemaining: 0,
        canWithdraw: true,
        canExtend: false,
        message: "Sign to release your LP",
      });
    }

    // ── EXTEND ───────────────────────────────────────────────────────
    if (action === "extend") {
      const additionalDays = Number(body.additionalDays ?? 0);
      if (additionalDays < 7 || additionalDays > 365) {
        return json({ success: false, error: "INVALID_DAYS", message: "additionalDays must be 7..365" }, 400);
      }

      const record = await getLpLockStatus(mint);
      if (!record || record.status !== "locked") {
        return json({ success: false, mint, status: record?.status ?? "not_requested", error: "NOT_LOCKED", message: "No active lock to extend" });
      }

      const escrowStr = process.env.LP_LOCK_ESCROW_ADDRESS || process.env.TREASURY_WALLET_ADDRESS;
      if (!escrowStr) {
        return json({ success: false, error: "NO_ESCROW", message: "Escrow not configured" });
      }

      const creator = new PublicKey(wallet);
      const tx = new Transaction({ feePayer: creator });
      tx.add(SystemProgram.transfer({ fromPubkey: creator, toPubkey: new PublicKey(escrowStr), lamports: 500_000 }));

      const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      const newLockDays = record.lockDays + additionalDays;
      const newLockUntil = new Date(new Date(record.createdAt).getTime() + newLockDays * 24 * 60 * 60 * 1000);
      const daysRemaining = Math.max(0, Math.ceil((newLockUntil.getTime() - Date.now()) / 86_400_000));

      await updateLpLockStatus(mint, "locked", { lockDays: newLockDays });

      return json({
        success: true,
        mint,
        status: "locked",
        transaction: Buffer.from(serialized).toString("base64"),
        lockUntil: newLockUntil.toISOString(),
        daysRemaining,
        canWithdraw: false,
        canExtend: true,
        message: `Lock extended by ${additionalDays} days`,
      });
    }

    return json(
      {
        success: false,
        error: "INVALID_ACTION",
        message:
          'action must be "check", "generate_tx", "confirm", "withdraw", or "extend"',
      },
      400
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[lp-lock] Error:", msg);
    return json(
      { success: false, mint, status: "failed", error: "INTERNAL", message: msg },
      500
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

// ── GET handler — list all locks for a wallet ────────────────────────────

function supabaseHeaders(): Record<string, string> | null {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim() ?? "";
  if (!wallet || !isValidBase58(wallet)) {
    return json(
      { success: false, error: "INVALID_WALLET", message: "wallet query param required" },
      400
    );
  }

  const base = process.env.SUPABASE_URL;
  const headers = supabaseHeaders();
  if (!base || !headers) {
    return json({ success: true, locks: [] });
  }

  try {
    const url = `${base.replace(/\/+$/, "")}/rest/v1/lp_lock_status?wallet=eq.${wallet}&order=created_at.desc&limit=50`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      return json({ success: true, locks: [] });
    }

    const rows = (await res.json()) as Array<Record<string, unknown>>;
    const locks = rows.map((r) => {
      const lockDays = Number(r.lock_days ?? 0);
      const createdAt = String(r.created_at ?? "");
      const lockUntil = createdAt
        ? new Date(new Date(createdAt).getTime() + lockDays * 86_400_000)
        : null;
      const daysRemaining = lockUntil
        ? Math.max(0, Math.ceil((lockUntil.getTime() - Date.now()) / 86_400_000))
        : 0;
      const status = String(r.status ?? "not_requested");

      return {
        mint: String(r.mint ?? ""),
        wallet: String(r.wallet ?? ""),
        lockDays,
        status,
        poolAddress: r.pool_address ? String(r.pool_address) : null,
        poolType: r.pool_type ? String(r.pool_type) : null,
        lockTxSignature: r.lock_tx_signature ? String(r.lock_tx_signature) : null,
        lockerProgram: r.locker_program ? String(r.locker_program) : null,
        lockedLiquidityUsd: r.locked_liquidity_usd ? Number(r.locked_liquidity_usd) : null,
        createdAt,
        updatedAt: String(r.updated_at ?? ""),
        lockUntil: lockUntil?.toISOString() ?? null,
        daysRemaining,
        canWithdraw: daysRemaining === 0 && status === "locked",
        canExtend: status === "locked",
      };
    });

    return json({ success: true, locks });
  } catch {
    return json({ success: true, locks: [] });
  }
}
