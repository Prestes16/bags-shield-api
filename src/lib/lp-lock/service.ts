/**
 * LP Lock Service — pool detection, status tracking, Supabase persistence.
 */

// ── Types ────────────────────────────────────────────────────────────────

export type LpLockStatus =
  | "awaiting_pool"
  | "pool_detected"
  | "lock_pending"
  | "locked"
  | "failed"
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

// ── Supabase helpers ─────────────────────────────────────────────────────

function supabaseHeaders(): Record<string, string> | null {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    prefer: "return=representation",
  };
}

function supabaseUrl(table: string): string | null {
  const url = process.env.SUPABASE_URL;
  if (!url) return null;
  return `${url.replace(/\/+$/, "")}/rest/v1/${table}`;
}

// ── Pool detection (DexScreener) ─────────────────────────────────────────

const SUPPORTED_DEXES = ["orca", "meteora", "raydium"] as const;

export async function detectPoolForMint(mint: string): Promise<{
  poolAddress: string;
  poolType: "orca" | "meteora" | "raydium";
  liquidityUsd: number;
} | null> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      pairs?: Array<{
        chainId: string;
        dexId: string;
        pairAddress: string;
        liquidity?: { usd?: number };
      }>;
    };

    if (!data.pairs?.length) return null;

    const solanaPairs = data.pairs
      .filter(
        (p) =>
          p.chainId === "solana" &&
          SUPPORTED_DEXES.includes(p.dexId as (typeof SUPPORTED_DEXES)[number])
      )
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

    if (solanaPairs.length === 0) return null;

    const best = solanaPairs[0];
    return {
      poolAddress: best.pairAddress,
      poolType: best.dexId as "orca" | "meteora" | "raydium",
      liquidityUsd: best.liquidity?.usd ?? 0,
    };
  } catch {
    return null;
  }
}

// ── Status persistence (Supabase) ────────────────────────────────────────

export async function updateLpLockStatus(
  mint: string,
  status: LpLockStatus,
  extra?: Partial<LpLockRecord>
): Promise<void> {
  const base = supabaseUrl("lp_lock_status");
  const headers = supabaseHeaders();
  if (!base || !headers) return;

  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
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

  // Upsert: if row with mint exists, update it; otherwise create
  await fetch(`${base}?mint=eq.${mint}`, {
    method: "PATCH",
    headers: { ...headers, prefer: "return=minimal" },
    body: JSON.stringify(row),
  }).then(async (res) => {
    // If PATCH returned 0 rows (404 or empty), INSERT instead
    if (!res.ok || res.status === 404) {
      row.created_at = row.created_at ?? now;
      await fetch(base, {
        method: "POST",
        headers: { ...headers, prefer: "return=minimal" },
        body: JSON.stringify(row),
      });
    }
  });
}

export async function getLpLockStatus(
  mint: string
): Promise<LpLockRecord | null> {
  const base = supabaseUrl("lp_lock_status");
  const headers = supabaseHeaders();
  if (!base || !headers) return null;

  try {
    const res = await fetch(`${base}?mint=eq.${mint}&limit=1`, {
      headers: { ...headers, prefer: "return=representation" },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    if (!rows.length) return null;

    const r = rows[0];
    return {
      mint: String(r.mint),
      wallet: String(r.wallet ?? ""),
      lockDays: Number(r.lock_days ?? 0),
      status: String(r.status ?? "not_requested") as LpLockStatus,
      poolAddress: r.pool_address ? String(r.pool_address) : undefined,
      poolType: r.pool_type
        ? (String(r.pool_type) as "orca" | "meteora" | "raydium")
        : undefined,
      lockTxSignature: r.lock_tx_signature
        ? String(r.lock_tx_signature)
        : undefined,
      lockerProgram: r.locker_program ? String(r.locker_program) : undefined,
      lockedLiquidityUsd: r.locked_liquidity_usd
        ? Number(r.locked_liquidity_usd)
        : undefined,
      createdAt: String(r.created_at ?? ""),
      updatedAt: String(r.updated_at ?? ""),
    };
  } catch {
    return null;
  }
}
