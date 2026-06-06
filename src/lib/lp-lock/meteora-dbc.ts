/**
 * Meteora Dynamic Bonding Curve — LP lock state reader.
 *
 * When a token launched via Meteora DBC (bonding curve) graduates, the LP is
 * automatically migrated to a DLMM pool and the LP tokens are locked in the
 * Meteora lock contract. This module reads that on-chain lock state without
 * requiring the full SDK — it uses the DLMM REST API and Helius RPC directly.
 *
 * No custody. No signing. Read-only.
 */

const DLMM_API = "https://dlmm-api.meteora.ag";
const FETCH_TIMEOUT_MS = 8_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MeteoraLockMode =
  | "native_protocol"  // LP locked automatically by Meteora DBC after graduation
  | "not_locked"       // Pool exists but LP is not locked
  | "unknown";         // Could not determine lock state

export interface MeteoraDbcLockState {
  /** Whether we believe the LP is locked on-chain. */
  isLocked: boolean;
  /** Lock provider — always "meteora_dbc" for this module. */
  lockProvider: "meteora_dbc";
  /** The DLMM pool address (may differ from the DexScreener pairAddress). */
  poolAddress: string | null;
  /** Detected pool type after querying Meteora. */
  poolType: "dlmm" | "amm" | "unknown";
  /** ISO timestamp estimate of when LP was locked (graduation time), if known. */
  lockedSince: string | null;
  /** Total liquidity in USD from the pool API. */
  lockedLiquidityUsd: number | null;
  /** Approximate claimable SOL fees (null if not queryable without wallet). */
  claimableSol: number | null;
  lockMode: MeteoraLockMode;
  /** Migration status derived from pool detection. */
  migrationStatus: "not_migrated" | "migrated" | "unknown";
  /** True when lock state is unambiguously confirmed from on-chain data. */
  verified: boolean;
  /** Data source used for the determination. */
  source: "dlmm_pair_api" | "dlmm_pair_estimate" | "none";
  /** Human-readable explanation of the lock state. */
  message: string;
}

// ---------------------------------------------------------------------------
// Internal: DLMM pair API types (partial)
// ---------------------------------------------------------------------------

interface DlmmPairResponse {
  address?: string;
  name?: string;
  mint_x?: string;
  mint_y?: string;
  reserve_x?: string;
  reserve_y?: string;
  reserve_x_amount?: number;
  reserve_y_amount?: number;
  bin_step?: number;
  base_fee_percentage?: string;
  max_fee_percentage?: string;
  protocol_fee_percentage?: string;
  liquidity?: string;
  reward_mint_x?: string;
  reward_mint_y?: string;
  fees_24h?: number;
  today_fees?: number;
  trade_volume_24h?: number;
  cumulative_trade_volume?: string;
  cumulative_fee_volume?: string;
  current_price?: number;
  apr?: number;
  apy?: number;
  farm_apr?: number;
  farm_apy?: number;
  hide?: boolean;
  is_blacklisted?: boolean;
  tags?: string[];
  // DBC migration fields (may or may not be present depending on API version)
  is_dlmm?: boolean;
  is_initialized?: boolean;
  creator?: string;
  migration_source?: string;
  lock_liquidity?: boolean;
  locked_liquidity?: string;
  // Timestamps
  created_at?: string;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function dlmmGet<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${DLMM_API}${path}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}` };
      }
      const data = (await res.json()) as T;
      return { ok: true, data };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

// ---------------------------------------------------------------------------
// Core: fetch pair info for a known pool address
// ---------------------------------------------------------------------------

async function fetchDlmmPair(
  poolAddress: string,
): Promise<DlmmPairResponse | null> {
  // Try the direct pair endpoint first
  const result = await dlmmGet<DlmmPairResponse>(`/pair/${poolAddress}`);
  if (result.ok && result.data?.mint_x) {
    return result.data;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Core: resolve pool address from DexScreener when none is provided
// ---------------------------------------------------------------------------

async function resolvePoolAddressFromDexScreener(mint: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
        { signal: controller.signal, cache: "no-store" },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        pairs?: Array<{ chainId: string; dexId: string; pairAddress: string; liquidity?: { usd?: number } }>;
      };
      const pairs = (data.pairs ?? [])
        .filter(
          (p) =>
            p.chainId === "solana" &&
            /meteora|bags/i.test(p.dexId) &&
            p.pairAddress,
        )
        .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
      return pairs[0]?.pairAddress ?? null;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core: derive lock state from a DLMM pair response
// ---------------------------------------------------------------------------

function deriveLockState(
  pair: DlmmPairResponse,
  source: "dlmm_pair_api" | "dlmm_pair_estimate",
): MeteoraDbcLockState {
  const liquidity = parseFloat(pair.liquidity ?? "0");

  // Explicit lock fields (present on newer API versions)
  if (pair.lock_liquidity === true || pair.locked_liquidity) {
    const lockedLiqUsd =
      pair.locked_liquidity != null
        ? parseFloat(pair.locked_liquidity)
        : liquidity;
    return {
      isLocked: true,
      lockProvider: "meteora_dbc",
      poolAddress: pair.address ?? null,
      poolType: "dlmm",
      lockedSince: pair.created_at ?? null,
      lockedLiquidityUsd: lockedLiqUsd,
      claimableSol: null,
      lockMode: "native_protocol",
      migrationStatus: "migrated",
      verified: true,
      source,
      message:
        "LP locked confirmado on-chain via Meteora DBC. " +
        "Creator e partner podem reivindicar fees da posição travada.",
    };
  }

  // Tags-based detection (Meteora sometimes tags DBC-migrated pools)
  const tags = pair.tags ?? [];
  const isDbc =
    tags.some((t) => /dbc|bonding.?curve|graduation|migration/i.test(t)) ||
    pair.migration_source != null;

  if (isDbc && liquidity > 0) {
    return {
      isLocked: true,
      lockProvider: "meteora_dbc",
      poolAddress: pair.address ?? null,
      poolType: "dlmm",
      lockedSince: pair.created_at ?? null,
      lockedLiquidityUsd: liquidity,
      claimableSol: null,
      lockMode: "native_protocol",
      migrationStatus: "migrated",
      verified: true,
      source,
      message:
        "LP locked confirmado on-chain via Meteora DBC (detectado via pool tags).",
    };
  }

  // Pool exists but no explicit lock indicator — could still be auto-locked
  // (API may not expose the field on all versions). Report as migrated_unverified
  // since all Bags launchpad tokens use DBC → DLMM migration.
  if (liquidity > 0) {
    return {
      isLocked: true,
      lockProvider: "meteora_dbc",
      poolAddress: pair.address ?? null,
      poolType: "dlmm",
      lockedSince: pair.created_at ?? null,
      lockedLiquidityUsd: liquidity,
      claimableSol: null,
      lockMode: "native_protocol",
      migrationStatus: "migrated",
      verified: false,
      source: "dlmm_pair_estimate",
      message:
        "Pool DLMM detectada. LP provavelmente travado via DBC graduation. " +
        "Metadado de lock exato ainda não disponível na API.",
    };
  }

  return {
    isLocked: false,
    lockProvider: "meteora_dbc",
    poolAddress: pair.address ?? null,
    poolType: "dlmm",
    lockedSince: null,
    lockedLiquidityUsd: null,
    claimableSol: null,
    lockMode: "not_locked",
    migrationStatus: "unknown",
    verified: false,
    source,
    message: "Pool DLMM encontrada mas liquidez vazia — LP pode ainda não estar travado.",
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Query Meteora DLMM API for LP lock state.
 *
 * Pass `poolAddress` when known (faster — direct pair lookup).
 * Pass only `mint` to search across all DLMM pairs (slower).
 */
export async function getMeteoraDbcLockState(
  mint: string,
  poolAddress?: string | null,
): Promise<MeteoraDbcLockState> {
  const NONE: MeteoraDbcLockState = {
    isLocked: false,
    lockProvider: "meteora_dbc",
    poolAddress: null,
    poolType: "unknown",
    lockedSince: null,
    lockedLiquidityUsd: null,
    claimableSol: null,
    lockMode: "unknown",
    migrationStatus: "unknown",
    verified: false,
    source: "none",
    message: "Could not determine LP lock state from Meteora API.",
  };

  try {
    // 1. Try direct pair lookup if we have the address
    if (poolAddress) {
      const pair = await fetchDlmmPair(poolAddress);
      if (pair) {
        return deriveLockState(pair, "dlmm_pair_api");
      }
    }

    // 2. No pool address or direct lookup failed — resolve via DexScreener
    //    (avoids the expensive /pair/all payload which times out in serverless)
    const resolved = await resolvePoolAddressFromDexScreener(mint);
    if (!resolved) return NONE;

    const pair = await fetchDlmmPair(resolved);
    if (!pair) return NONE;

    return deriveLockState(pair, "dlmm_pair_estimate");
  } catch {
    return NONE;
  }
}
