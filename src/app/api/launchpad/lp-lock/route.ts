import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import {
  detectPoolForMint,
  enrichLpLockRecord,
  getLpLockCapabilities,
  getLpLockStatus,
  listLpLocksForWallet,
  updateLpLockStatus,
  type LpLockRecord,
} from "@/lib/lp-lock/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LpLockAction =
  | "capabilities"
  | "schedule"
  | "check"
  | "generate_tx"
  | "confirm"
  | "withdraw"
  | "extend";

interface LpLockBody {
  mint?: string;
  wallet?: string;
  action?: LpLockAction;
  txSignature?: string;
  lockDays?: number;
  additionalDays?: number;
}

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function json(req: NextRequest, body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "access-control-allow-origin": process.env.FRONTEND_URL || "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
    },
  });
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

function isValidPublicKey(value: string): boolean {
  try {
    new PublicKey(value);
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
  } catch {
    return false;
  }
}

function validLockDays(value: unknown): number {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 7 || days > 3650) {
    throw new Error("lockDays must be an integer between 7 and 3650");
  }
  return days;
}

function protocolUnavailable(req: NextRequest, mint: string, status: string | undefined, action: string) {
  const capabilities = getLpLockCapabilities();
  return json(
    req,
    {
      success: false,
      mint,
      status: status ?? "not_requested",
      error: {
        code: "PROTOCOL_LOCK_NOT_CONFIGURED",
        message:
          action === "withdraw"
            ? "Liquidity withdrawal is unavailable because no real LP locker is configured for this launch."
            : action === "extend"
              ? "On-chain lock extension is unavailable because no real LP locker is configured for this launch."
              : "LP lock transaction generation is unavailable until an approved protocol locker is configured.",
      },
      capabilities,
    },
    501,
  );
}

function responseFromRecord(record: LpLockRecord | null, pool?: Awaited<ReturnType<typeof detectPoolForMint>>) {
  const capabilities = getLpLockCapabilities();
  const enriched = record ? enrichLpLockRecord(record) : null;

  return {
    success: true,
    mint: record?.mint ?? null,
    status: record?.status ?? "not_requested",
    pool: pool
      ? {
          poolAddress: pool.poolAddress,
          poolType: pool.poolType,
          type: pool.poolType,
          liquidityUsd: pool.liquidityUsd,
        }
      : undefined,
    lockDays: record?.lockDays ?? null,
    lockTxSignature: record?.lockTxSignature ?? null,
    lockerProgram: record?.lockerProgram ?? null,
    verificationUrl: record?.lockTxSignature
      ? `https://solscan.io/tx/${record.lockTxSignature}`
      : null,
    lockUntil: enriched?.lockUntil ?? null,
    daysRemaining: enriched?.daysRemaining ?? 0,
    canWithdraw: enriched?.canWithdraw ?? false,
    canExtend: enriched?.canExtend ?? false,
    canGenerateLockTx: enriched?.canGenerateLockTx ?? false,
    lockProviderAvailable: enriched?.lockProviderAvailable ?? capabilities.providerConfigured,
    lockMode: enriched?.lockMode ?? capabilities.mode,
    providerMessage: enriched?.providerMessage ?? capabilities.message,
    capabilities,
  };
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return json(req, { success: false, error: { code: "RATE_LIMITED", message: "Too many requests" } }, 429);
  }

  let body: LpLockBody;
  try {
    body = (await req.json()) as LpLockBody;
  } catch {
    return json(req, { success: false, error: { code: "INVALID_JSON", message: "Body must be JSON" } }, 400);
  }

  const action = body.action ?? "check";
  if (action === "capabilities") {
    return json(req, { success: true, response: getLpLockCapabilities() });
  }

  const mint = String(body.mint ?? "").trim();
  const wallet = String(body.wallet ?? "").trim();

  if (!mint || !isValidPublicKey(mint)) {
    return json(req, { success: false, error: { code: "INVALID_MINT", message: "Invalid mint" } }, 400);
  }

  if (!wallet || !isValidPublicKey(wallet)) {
    return json(req, { success: false, error: { code: "INVALID_WALLET", message: "Invalid wallet" } }, 400);
  }

  try {
    if (action === "schedule") {
      const lockDays = validLockDays(body.lockDays ?? body.additionalDays ?? 90);
      const pool = await detectPoolForMint(mint);
      const record = await updateLpLockStatus(mint, pool ? "pool_detected" : "awaiting_pool", {
        wallet,
        lockDays,
        ...(pool
          ? {
              poolAddress: pool.poolAddress,
              poolType: pool.poolType,
              lockedLiquidityUsd: pool.liquidityUsd,
            }
          : {}),
      });

      return json(req, {
        ...responseFromRecord(record, pool),
        lpLockScheduled: {
          status: record?.status ?? (pool ? "pool_detected" : "awaiting_pool"),
          lockDays,
          mint,
        },
      });
    }

    if (action === "check") {
      let record = await getLpLockStatus(mint);
      const pool = await detectPoolForMint(mint);

      if (record?.status === "awaiting_pool" && pool) {
        record = await updateLpLockStatus(mint, "pool_detected", {
          poolAddress: pool.poolAddress,
          poolType: pool.poolType,
          lockedLiquidityUsd: pool.liquidityUsd,
        });
      }

      return json(req, responseFromRecord(record, pool));
    }

    if (action === "generate_tx" || action === "withdraw" || action === "extend") {
      const record = await getLpLockStatus(mint);
      return protocolUnavailable(req, mint, record?.status, action);
    }

    if (action === "confirm") {
      const record = await getLpLockStatus(mint);
      return json(
        req,
        {
          success: false,
          mint,
          status: record?.status ?? "not_requested",
          error: {
            code: "CONFIRM_UNSUPPORTED",
            message: "LP lock confirmation requires a real protocol locker transaction.",
          },
          capabilities: getLpLockCapabilities(),
        },
        501,
      );
    }

    return json(
      req,
      {
        success: false,
        error: {
          code: "INVALID_ACTION",
          message:
            'action must be "capabilities", "schedule", "check", "generate_tx", "confirm", "withdraw", or "extend"',
        },
      },
      400,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[lp-lock] error", { action, mint, message });
    return json(req, { success: false, error: { code: "INTERNAL", message } }, 500);
  }
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim() ?? "";
  if (!wallet || !isValidPublicKey(wallet)) {
    return json(req, { success: false, error: { code: "INVALID_WALLET", message: "wallet query param required" } }, 400);
  }

  const records = await listLpLocksForWallet(wallet);
  return json(req, {
    success: true,
    locks: records.map(enrichLpLockRecord),
    capabilities: getLpLockCapabilities(),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": process.env.FRONTEND_URL || "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
    },
  });
}
