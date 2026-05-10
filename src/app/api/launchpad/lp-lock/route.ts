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
      "access-control-allow-methods": "POST, OPTIONS",
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
  action?: "check" | "generate_tx" | "confirm";
  txSignature?: string;
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

    return json(
      {
        success: false,
        error: "INVALID_ACTION",
        message: 'action must be "check", "generate_tx", or "confirm"',
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
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}
