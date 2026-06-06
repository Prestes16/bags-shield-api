/**
 * LP lock service.
 *
 * This module only tracks launch intents and verifies observable pool data.
 * It does not create custody, does not sign transactions, and does not mark
 * liquidity as locked unless a real protocol locker can be verified.
 *
 * For tokens launched via Meteora DBC (Bags launchpad), LP is automatically
 * locked on-chain after graduation. Use enrichLpLockRecordWithOnChainData()
 * to fetch the real lock state from the Meteora DLMM API.
 */

import { getMeteoraDbcLockState } from "./meteora-dbc";
import { getClaimablePositions } from "@/lib/launchpad/bags-client";
import { BAGS_SHIELD_FEE_SHARE_WALLET } from "@/lib/launchpad/fees";
import { SafeLogger } from "@/lib/security";

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

const SUPPORTED_DEXES = ["orca", "meteora", "raydium", "bags"] as const;

/**
 * Map a DexScreener dexId to our internal pool family. Bags launchpad pools are
 * Meteora Dynamic Bonding Curve (DBC) pools under the hood, so dexId "bags" is
 * treated as "meteora" — this is what triggers on-chain DBC lock verification via
 * getMeteoraDbcLockState(). The record stays verified:false until on-chain proof.
 */
function mapDexIdToPoolType(dexId: string): "orca" | "meteora" | "raydium" {
  if (dexId === "bags") return "meteora";
  return dexId as "orca" | "meteora" | "raydium";
}

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
    providerConfigured: true,
    provider: "meteora_dbc" as const,
    lockProvider: "meteora_dbc" as const,
    lockMode: "native_protocol" as const,
    canGenerateLockTransaction: false,
    canWithdraw: false,
    canExtendOnChain: false,
    message:
      "LP locked automatically by Meteora DBC after graduation. Bags Shield reads and verifies the on-chain lock state.",
  };
}

export interface DetectPoolOptions {
  wallet?: string;
  requestId?: string;
}

// A) DexScreener — works in local/dev, but its endpoint is frequently rate-limited
// or blocked for serverless egress IPs, so it is only the first attempt.
async function detectPoolViaDexScreener(
  mint: string,
  requestId?: string,
): Promise<DetectedPool | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      SafeLogger.warn("LP-lock pool detect: DexScreener non-OK", {
        requestId,
        mint,
        provider: "dexscreener",
        httpStatus: res.status,
      });
      return null;
    }

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
    SafeLogger.info("LP-lock pool detect: DexScreener probe", {
      requestId,
      mint,
      provider: "dexscreener",
      httpStatus: res.status,
      pairCount: pairs.length,
      dexIds: [...new Set(pairs.map((pair) => pair.dexId))].slice(0, 8),
      accepted: Boolean(best),
    });

    if (!best) return null;
    return {
      poolAddress: best.pairAddress,
      poolType: mapDexIdToPoolType(best.dexId),
      liquidityUsd: best.liquidity?.usd ?? 0,
    };
  } catch (error) {
    SafeLogger.warn("LP-lock pool detect: DexScreener failed", {
      requestId,
      mint,
      provider: "dexscreener",
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// B) Bags claimable-positions — authenticated Bags API (works from serverless).
// The Bags Shield treasury is a fee claimer on every launch, so its positions
// reliably expose the token's virtual pool even when DexScreener is blocked.
async function detectPoolViaBagsClaimable(
  mint: string,
  wallets: string[],
  requestId?: string,
): Promise<DetectedPool | null> {
  for (const wallet of wallets) {
    if (!wallet) continue;
    try {
      const result = await getClaimablePositions(wallet);
      if ("error" in result) {
        SafeLogger.warn("LP-lock pool detect: Bags claimable error", {
          requestId,
          mint,
          provider: "bags_claimable",
          walletTried: `${wallet.slice(0, 4)}...`,
          code: result.error.code,
        });
        continue;
      }
      const positions = Array.isArray(result.response)
        ? (result.response as unknown as Array<Record<string, unknown>>)
        : [];
      const match = positions.find((pos) => {
        const posMint = (pos.baseMint ?? pos.tokenMint) as string | undefined;
        return posMint === mint;
      });
      const poolAddress = match
        ? ((match.virtualPool ?? match.poolAddress) as string | undefined)
        : undefined;

      SafeLogger.info("LP-lock pool detect: Bags claimable probe", {
        requestId,
        mint,
        provider: "bags_claimable",
        walletTried: `${wallet.slice(0, 4)}...`,
        positionCount: positions.length,
        matched: Boolean(poolAddress),
      });

      if (poolAddress) {
        return { poolAddress, poolType: "meteora", liquidityUsd: 0 };
      }
    } catch (error) {
      SafeLogger.warn("LP-lock pool detect: Bags claimable threw", {
        requestId,
        mint,
        provider: "bags_claimable",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return null;
}

/**
 * Resolve the on-chain pool for a token mint from the most reliable source
 * available. Pool detected does NOT mean LP is locked/verified -- that is only
 * confirmed later by getMeteoraDbcLockState() with real on-chain proof.
 */
export async function detectPoolForMint(
  mint: string,
  opts: DetectPoolOptions = {},
): Promise<DetectedPool | null> {
  const requestId = opts.requestId;

  // A) DexScreener
  const viaDex = await detectPoolViaDexScreener(mint, requestId);
  if (viaDex) return viaDex;

  // B) Bags claimable-positions (caller wallet + Bags Shield treasury claimer)
  const candidateWallets = [opts.wallet, BAGS_SHIELD_FEE_SHARE_WALLET].filter(
    (wallet, index, arr) => Boolean(wallet) && arr.indexOf(wallet) === index,
  ) as string[];
  const viaBags = await detectPoolViaBagsClaimable(mint, candidateWallets, requestId);
  if (viaBags) return viaBags;

  // C) Persisted record (Supabase) -- reuse a previously detected pool address
  try {
    const record = await getLpLockStatus(mint);
    if (record?.poolAddress) {
      SafeLogger.info("LP-lock pool detect: from persisted record", {
        requestId,
        mint,
        provider: "supabase_record",
      });
      return {
        poolAddress: record.poolAddress,
        poolType: record.poolType ?? "meteora",
        liquidityUsd: record.lockedLiquidityUsd ?? 0,
      };
    }
  } catch {
    // best-effort only
  }

  // D) Nothing found -- caller keeps awaiting_pool
  SafeLogger.warn("LP-lock pool detect: not found", {
    requestId,
    mint,
    reason: "no_pool_from_dexscreener_bags_or_record",
    walletsTried: candidateWallets.length,
  });
  return null;
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

  // native_protocol mode — Meteora DBC handles the lock automatically on graduation
  const canGenerateLockTx = false;
  const lockProviderAvailable = true;
  const lockProvider = "meteora_dbc" as const;
  const lockMode = "native_protocol" as const;
  const migrationStatus = (
    record.status === "locked" ? "migrated" :
    record.poolAddress ? "migrated" :
    "unknown"
  ) as "migrated" | "unknown";
  const verified = false; // overridden to true by enrichLpLockRecordWithOnChainData when confirmed
  const providerMessage =
    "Auto-lock via Meteora DBC - LP locked automatically by the protocol after graduation.";

  return {
    ...record,
    lockUntil,
    daysRemaining,
    canWithdraw,
    canExtend,
    canGenerateLockTx,
    lockProviderAvailable,
    lockProvider,
    lockMode,
    migrationStatus,
    verified,
    providerMessage,
  };
}

/**
 * Async version of enrichLpLockRecord that additionally queries the Meteora
 * DLMM API for real on-chain lock state when the pool type is Meteora.
 *
 * For non-Meteora pools, falls back to the synchronous enrichLpLockRecord().
 */
export async function enrichLpLockRecordWithOnChainData(record: LpLockRecord) {
  const base = enrichLpLockRecord(record);

  // Only query Meteora on-chain if the pool is Meteora-based
  const isMeteora =
    record.poolType === "meteora" ||
    (record.poolAddress && record.poolAddress.length > 0 && !record.poolType);

  if (!isMeteora) return base;

  try {
    const onChain = await getMeteoraDbcLockState(record.mint, record.poolAddress);

    if (!onChain.isLocked) return base;

    // Merge on-chain data — override lockMode and providerMessage with real state
    return {
      ...base,
      // Update status if we now know LP is locked on-chain
      status: (record.status === "pool_detected" || record.status === "awaiting_pool"
        ? "locked"
        : record.status) as LpLockStatus,
      lockedLiquidityUsd: onChain.lockedLiquidityUsd ?? base.lockedLiquidityUsd,
      lockProvider: "meteora_dbc" as const,
      lockMode: onChain.lockMode,
      lockProviderAvailable: true,
      canGenerateLockTx: false, // LP already locked automatically — no new TX needed
      migrationStatus: "migrated" as const,
      verified: onChain.verified,
      providerMessage: onChain.message,
      // On-chain enrichments
      onChain: {
        provider: "meteora_dbc",
        poolAddress: onChain.poolAddress,
        poolType: onChain.poolType,
        lockedSince: onChain.lockedSince,
        lockedLiquidityUsd: onChain.lockedLiquidityUsd,
        claimableSol: onChain.claimableSol,
        source: onChain.source,
        verified: onChain.verified,
      },
    };
  } catch {
    // On-chain query failed — fall back to base enrichment
    return base;
  }
}
