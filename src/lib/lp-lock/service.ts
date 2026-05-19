/**
 * LP lock service.
 *
 * This module only tracks launch intents and verifies observable pool data.
 * It does not create custody, does not sign transactions, and does not mark
 * liquidity as locked unless a real protocol locker can be verified.
 */

export type LpLockStatus =
  | "awaiting_pool"
  | "pool_detected"
  | "lock_pending"
  | "locked"
  | "failed"
  | "withdrawn"
  | "not_requested";

export interface LpLockRecord {
  mint: string;
  wallet: string;
  lockDays: number;
  status: LpLockStatus;
  poolAddress?: string;
  poolType?: "orca" | "meteora" | "raydium";
  lockTxSignature?: string;
  lockerProgram?: string;
  lockedLiquidityUsd?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DetectedPool {
  poolAddress: string;
  poolType: "orca" | "meteora" | "raydium";
  liquidityUsd: number;
}

const SUPPORTED_DEXES = ["orca", "meteora", "raydium"] as const;

function supabaseHeaders(): Record<string, string> | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!process.env.SUPABASE_URL || !key) return null;

  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
}

function supabaseUrl(table: string): string | null {
  const url = process.env.SUPABASE_URL;
  if (!url) return null;
  return `${url.replace(/\/+$/, "")}/rest/v1/${table}`;
}

function toRecord(row: Record<string, unknown>): LpLockRecord {
  return {
    mint: String(row.mint ?? ""),
    wallet: String(row.wallet ?? ""),
    lockDays: Number(row.lock_days ?? 0),
    status: String(row.status ?? "not_requested") as LpLockStatus,
    poolAddress: row.pool_address ? String(row.pool_address) : undefined,
    poolType: row.pool_type
      ? (String(row.pool_type) as "orca" | "meteora" | "raydium")
      : undefined,
    lockTxSignature: row.lock_tx_signature ? String(row.lock_tx_signature) : undefined,
    lockerProgram: row.locker_program ? String(row.locker_program) : undefined,
    lockedLiquidityUsd:
      row.locked_liquidity_usd == null ? undefined : Number(row.locked_liquidity_usd),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function buildRow(
  mint: string,
  status: LpLockStatus,
  extra?: Partial<LpLockRecord>,
): Record<string, unknown> {
  const now = new Date().toISOString();

  return {
    mint,
    status,
    updated_at: now,
    ...(extra?.wallet && { wallet: extra.wallet }),
    ...(extra?.lockDays != null && { lock_days: extra.lockDays }),
    ...(extra?.poolAddress && { pool_address: extra.poolAddress }),
    ...(extra?.poolType && { pool_type: extra.poolType }),
    ...(extra?.lockTxSignature && { lock_tx_signature: extra.lockTxSignature }),
    ...(extra?.lockerProgram && { locker_program: extra.lockerProgram }),
    ...(extra?.lockedLiquidityUsd != null && {
      locked_liquidity_usd: extra.lockedLiquidityUsd,
    }),
    ...(extra?.createdAt && { created_at: extra.createdAt }),
  };
}

export function getLpLockCapabilities() {
  return {
    providerConfigured: false,
    provider: null as string | null,
    canGenerateLockTransaction: false,
    canWithdraw: false,
    canExtendOnChain: false,
    mode: "monitor_only" as const,
    message:
      "Real protocol LP locking is not configured. Bags Shield can monitor pool creation and fee claims, but will not simulate LP custody.",
  };
}

export async function detectPoolForMint(mint: string): Promise<DetectedPool | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      pairs?: Array<{
        chainId: string;
        dexId: string;
        pairAddress: string;
        liquidity?: { usd?: number };
      }>;
    };

    const pairs = data.pairs ?? [];
    const solanaPairs = pairs
      .filter(
        (pair) =>
          pair.chainId === "solana" &&
          SUPPORTED_DEXES.includes(pair.dexId as (typeof SUPPORTED_DEXES)[number]) &&
          pair.pairAddress,
      )
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

    const best = solanaPairs[0];
    if (!best) return null;

    return {
      poolAddress: best.pairAddress,
      poolType: best.dexId as "orca" | "meteora" | "raydium",
      liquidityUsd: best.liquidity?.usd ?? 0,
    };
  } catch {
    return null;
  }
}

export async function getLpLockStatus(mint: string): Promise<LpLockRecord | null> {
  const base = supabaseUrl("lp_lock_status");
  const headers = supabaseHeaders();
  if (!base || !headers) return null;

  try {
    const res = await fetch(`${base}?mint=eq.${encodeURIComponent(mint)}&limit=1`, {
      headers: { ...headers, prefer: "return=representation" },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows[0] ? toRecord(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function updateLpLockStatus(
  mint: string,
  status: LpLockStatus,
  extra?: Partial<LpLockRecord>,
): Promise<LpLockRecord | null> {
  const base = supabaseUrl("lp_lock_status");
  const headers = supabaseHeaders();
  if (!base || !headers) return null;

  const now = new Date().toISOString();
  const existing = await getLpLockStatus(mint);
  const row = buildRow(mint, status, {
    ...extra,
    createdAt: existing?.createdAt || extra?.createdAt || now,
  });

  if (existing) {
    const res = await fetch(`${base}?mint=eq.${encodeURIComponent(mint)}`, {
      method: "PATCH",
      headers: { ...headers, prefer: "return=representation" },
      body: JSON.stringify(row),
      cache: "no-store",
    });

    if (!res.ok) return existing;
    const rows = (await res.json().catch(() => [])) as Array<Record<string, unknown>>;
    return rows[0] ? toRecord(rows[0]) : { ...existing, ...extra, status };
  }

  const res = await fetch(base, {
    method: "POST",
    headers: { ...headers, prefer: "return=representation" },
    body: JSON.stringify(row),
    cache: "no-store",
  });

  if (!res.ok) return null;
  const rows = (await res.json().catch(() => [])) as Array<Record<string, unknown>>;
  return rows[0] ? toRecord(rows[0]) : null;
}

export async function listLpLocksForWallet(wallet: string): Promise<LpLockRecord[]> {
  const base = supabaseUrl("lp_lock_status");
  const headers = supabaseHeaders();
  if (!base || !headers) return [];

  try {
    const url = `${base}?wallet=eq.${encodeURIComponent(wallet)}&order=created_at.desc&limit=50`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return [];

    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map(toRecord);
  } catch {
    return [];
  }
}

export function enrichLpLockRecord(record: LpLockRecord) {
  const lockUntil =
    record.createdAt && record.lockDays > 0
      ? new Date(
          new Date(record.createdAt).getTime() + record.lockDays * 86_400_000,
        ).toISOString()
      : null;

  const now = Date.now();
  const lockUntilMs = lockUntil ? new Date(lockUntil).getTime() : 0;
  const daysRemaining = lockUntil
    ? Math.max(0, Math.ceil((lockUntilMs - now) / 86_400_000))
    : 0;

  const canWithdraw =
    record.status === "locked" && lockUntilMs > 0 && lockUntilMs <= now;
  const canExtend = record.status === "locked" && !canWithdraw;

  // monitor_only mode — no real on-chain lock provider configured
  const canGenerateLockTx = false;
  const lockProviderAvailable = false;
  const lockMode = "monitor_only" as const;
  const providerMessage =
    "Real protocol LP locking is not configured. " +
    "Bags Shield monitors pool creation and fee claims but will not simulate LP custody.";

  return {
    ...record,
    lockUntil,
    daysRemaining,
    canWithdraw,
    canExtend,
    canGenerateLockTx,
    lockProviderAvailable,
    lockMode,
    providerMessage,
  };
}
