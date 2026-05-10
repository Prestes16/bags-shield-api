/**
 * Orca Whirlpool LP lock detection.
 *
 * Two detection layers (both fail-safe):
 *   1. DexScreener `info.liquidityLocked` — zero extra RPC calls, fast path
 *   2. Native Orca PositionLock PDA check via Helius getMultipleAccounts
 *
 * Known locker programs (third-party) checked via NFT owner in Phase 2.
 * This module is purely additive — if it errors, lpLocked stays null.
 */

import { PublicKey } from '@solana/web3.js';
import { getHeliusRpcUrl } from '@/lib/helius';
import { fetchGuard } from './fetchGuard';
import { circuitAllow, circuitFailure, circuitSuccess } from './circuitBreaker';
import { cacheGet, cacheSet, cacheKey, getTtlMs } from './cache';

// ── Constants ────────────────────────────────────────────────────────────────

const PROVIDER = 'orca';
const CB_KEY   = 'orca:lock';

/** Orca Whirlpools on-chain program (mainnet) */
const ORCA_WHIRLPOOL_PROGRAM = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';

/**
 * Known third-party LP locker programs on Solana.
 * When a position NFT is owned by one of these → locked.
 */
export const KNOWN_LOCKER_PROGRAMS = new Set([
  'strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m', // Streamflow v1 timelock
  '8e72pYCDaxu3GqMfeQ5r8wFgoZSYk6oua1Qo9XpsZjX', // Streamflow community
  'GEdsRPKcAeXuPNxwWqeXbNqPXaSnMAbAy3SUKTV5jvH6', // Fluxbeam locker (verify)
]);

// Orca Position account layout (Anchor, after 8-byte discriminator):
//   [8..40]  whirlpool pubkey
//   [40..72] position_mint pubkey
//   [72..]   liquidity, ticks, fees, rewards…
const POSITION_POOL_OFFSET  = 8;   // offset of whirlpool pubkey in position account
const POSITION_MINT_OFFSET  = 40;  // offset of position_mint pubkey
const POSITION_MINT_LENGTH  = 32;

// Max positions to inspect per pool (limits RPC budget)
const MAX_POSITIONS_PER_POOL = 8;
// Max pools to inspect (DexScreener may return many Orca pairs)
const MAX_POOLS = 2;

// ── Types ────────────────────────────────────────────────────────────────────

export interface OrcaLockCheckResult {
  ok: boolean;
  latencyMs: number;
  /** null = couldn't determine; true/false = definitive */
  locked: boolean | null;
  /** 'orca-native' | 'streamflow' | etc. */
  lockerProgram: string | null;
  /** How many positions appear locked */
  lockedPositions: number;
  /** How many positions were inspected */
  totalPositions: number;
  /** USD value confirmed locked (from DexScreener fast-path) */
  lockedLiquidityUsd: number | null;
  error?: string;
  quality: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive the Orca native PositionLock PDA for a given position NFT mint.
 * Seeds: ["position_lock", position_mint_bytes]
 */
function derivePositionLockPda(positionMint: string): string | null {
  try {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('position_lock'), new PublicKey(positionMint).toBuffer()],
      new PublicKey(ORCA_WHIRLPOOL_PROGRAM),
    );
    return pda.toBase58();
  } catch {
    return null;
  }
}

/** Generic Helius JSON-RPC call via fetchGuard. */
async function heliusRpc<T>(
  method: string,
  params: unknown[],
  rpcUrl: string,
  timeoutMs = 5_000,
): Promise<{ ok: boolean; result?: T; error?: string }> {
  const res = await fetchGuard<{ result?: T; error?: { message?: string } }>(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: method, method, params }),
    timeoutMs,
  });

  if (res.ok && res.data) {
    if (res.data.error) return { ok: false, error: String(res.data.error.message ?? 'RPC error') };
    return { ok: true, result: res.data.result as T };
  }
  return { ok: false, error: res.error ?? `HTTP ${res.status}` };
}

// ── Fast-path: DexScreener liquidityLocked ───────────────────────────────────

/**
 * Extract locked liquidity USD from DexScreener pair data.
 * DexScreener sometimes surfaces `info.liquidityLocked` (in USD) for Orca pairs.
 * Returns null if the field is absent.
 */
export function extractDexScreenerLockInfo(dexScreenerData: unknown): {
  lockedUsd: number | null;
  orcaPoolAddresses: string[];
} {
  const out = { lockedUsd: null as number | null, orcaPoolAddresses: [] as string[] };

  if (!dexScreenerData || typeof dexScreenerData !== 'object') return out;

  const d = dexScreenerData as Record<string, unknown>;
  const pairs = Array.isArray(d.pairs) ? d.pairs : (Array.isArray(d) ? d : []);
  if (!Array.isArray(pairs)) return out;

  let totalLocked = 0;
  let hasLockData = false;

  for (const pair of pairs as Record<string, unknown>[]) {
    const dexId = String(pair.dexId ?? pair.dex_id ?? '');
    const pairAddress = String(pair.pairAddress ?? pair.pair_address ?? '');

    // Collect Orca pool addresses for on-chain check
    if (dexId === 'orca' && pairAddress && pairAddress.length >= 32) {
      out.orcaPoolAddresses.push(pairAddress);
    }

    // DexScreener v3: info.liquidityLocked (present when lock detected)
    const info = pair.info as Record<string, unknown> | undefined;
    const locked = info?.liquidityLocked ?? info?.lockedLiquidity;
    if (typeof locked === 'number' && locked > 0) {
      totalLocked += locked;
      hasLockData = true;
    }
  }

  out.lockedUsd = hasLockData ? totalLocked : null;
  return out;
}

// ── On-chain: Orca PositionLock PDA check ────────────────────────────────────

/**
 * Fetch Whirlpool position accounts for a pool and extract position NFT mints.
 * Uses getProgramAccounts with a memcmp filter on the pool pubkey.
 */
async function fetchPositionMintsForPool(
  poolAddress: string,
  rpcUrl: string,
): Promise<string[]> {
  type ProgramAccount = { account: { data: [string, string] } };

  const res = await heliusRpc<ProgramAccount[]>(
    'getProgramAccounts',
    [
      ORCA_WHIRLPOOL_PROGRAM,
      {
        encoding: 'base64',
        filters: [
          // pool pubkey starts at offset 8 (after 8-byte Anchor discriminator)
          { memcmp: { offset: POSITION_POOL_OFFSET, bytes: poolAddress } },
        ],
        withContext: false,
      },
    ],
    rpcUrl,
    8_000,
  );

  if (!res.ok || !Array.isArray(res.result)) return [];

  const mints: string[] = [];
  for (const acc of res.result.slice(0, MAX_POSITIONS_PER_POOL)) {
    const dataBase64 = acc.account?.data?.[0];
    if (!dataBase64) continue;
    try {
      const buf = Buffer.from(dataBase64, 'base64');
      if (buf.length < POSITION_MINT_OFFSET + POSITION_MINT_LENGTH) continue;
      const mintBytes = buf.slice(POSITION_MINT_OFFSET, POSITION_MINT_OFFSET + POSITION_MINT_LENGTH);
      mints.push(new PublicKey(mintBytes).toBase58());
    } catch {
      // skip malformed accounts
    }
  }
  return mints;
}

/**
 * Check which PositionLock PDAs exist on-chain using getMultipleAccounts.
 * Returns a Set of position mints that are natively locked.
 */
async function checkNativeLocks(
  positionMints: string[],
  rpcUrl: string,
): Promise<Set<string>> {
  if (positionMints.length === 0) return new Set();

  const pdaMap = new Map<string, string>(); // pda → positionMint
  for (const mint of positionMints) {
    const pda = derivePositionLockPda(mint);
    if (pda) pdaMap.set(pda, mint);
  }

  if (pdaMap.size === 0) return new Set();

  type AccountValue = { lamports: number } | null;
  type MultipleAccountsResult = { value: AccountValue[] };

  const res = await heliusRpc<MultipleAccountsResult>(
    'getMultipleAccounts',
    [Array.from(pdaMap.keys()), { encoding: 'base64' }],
    rpcUrl,
    5_000,
  );

  const locked = new Set<string>();
  if (!res.ok || !res.result?.value) return locked;

  const pdaKeys = Array.from(pdaMap.keys());
  for (let i = 0; i < pdaKeys.length; i++) {
    const accountValue = res.result.value[i];
    if (accountValue && typeof accountValue === 'object' && accountValue.lamports > 0) {
      // PositionLock account exists → position is natively locked by Orca
      const mint = pdaMap.get(pdaKeys[i]);
      if (mint) locked.add(mint);
    }
  }
  return locked;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Check LP lock status for a token's Orca pools.
 *
 * @param dexScreenerData  Raw DexScreener response (already fetched by scan pipeline)
 */
export async function checkOrcaLpLock(
  dexScreenerData: unknown,
): Promise<OrcaLockCheckResult> {
  const start = Date.now();

  // ── Fast path: DexScreener lock info ────────────────────────────────────
  const { lockedUsd, orcaPoolAddresses } = extractDexScreenerLockInfo(dexScreenerData);

  // If DexScreener already confirms lock, return immediately
  if (lockedUsd !== null && lockedUsd > 0) {
    return {
      ok: true,
      latencyMs: Date.now() - start,
      locked: true,
      lockerProgram: 'dexscreener-confirmed',
      lockedPositions: 1,
      totalPositions: 1,
      lockedLiquidityUsd: lockedUsd,
      quality: ['DEXSCREENER_FAST_PATH'],
    };
  }

  if (orcaPoolAddresses.length === 0) {
    return {
      ok: true,
      latencyMs: Date.now() - start,
      locked: null,
      lockerProgram: null,
      lockedPositions: 0,
      totalPositions: 0,
      lockedLiquidityUsd: null,
      quality: ['NO_ORCA_POOLS'],
    };
  }

  // ── Cache check ──────────────────────────────────────────────────────────
  const cacheKeyStr = cacheKey(PROVIDER, 'lock', {
    pools: orcaPoolAddresses.slice(0, MAX_POOLS).join(','),
  });
  const cached = cacheGet<OrcaLockCheckResult>(cacheKeyStr);
  if (cached.hit && cached.data) return { ...cached.data, latencyMs: 0, quality: ['CACHE_HIT'] };

  if (!circuitAllow(CB_KEY)) {
    return {
      ok: false,
      latencyMs: 0,
      locked: null,
      lockerProgram: null,
      lockedPositions: 0,
      totalPositions: 0,
      lockedLiquidityUsd: null,
      error: 'Circuit open',
      quality: ['DEGRADED'],
    };
  }

  const rpcUrl = getHeliusRpcUrl();
  if (!rpcUrl) {
    return {
      ok: false,
      latencyMs: 0,
      locked: null,
      lockerProgram: null,
      lockedPositions: 0,
      totalPositions: 0,
      lockedLiquidityUsd: null,
      error: 'Helius not configured',
      quality: ['DEGRADED'],
    };
  }

  // ── On-chain: PositionLock PDA check ─────────────────────────────────────
  try {
    const poolsToCheck = orcaPoolAddresses.slice(0, MAX_POOLS);
    const allMints: string[] = [];

    // Fetch position mints for each pool (sequential to stay within RPC budget)
    for (const pool of poolsToCheck) {
      const mints = await fetchPositionMintsForPool(pool, rpcUrl);
      allMints.push(...mints);
    }

    const totalPositions = allMints.length;

    if (totalPositions === 0) {
      circuitSuccess(CB_KEY);
      return {
        ok: true,
        latencyMs: Date.now() - start,
        locked: null,
        lockerProgram: null,
        lockedPositions: 0,
        totalPositions: 0,
        lockedLiquidityUsd: null,
        quality: ['NO_POSITIONS'],
      };
    }

    // Batch-check PositionLock PDAs
    const nativeLockedMints = await checkNativeLocks(allMints, rpcUrl);
    const lockedPositions = nativeLockedMints.size;

    circuitSuccess(CB_KEY);

    const result: OrcaLockCheckResult = {
      ok: true,
      latencyMs: Date.now() - start,
      locked: lockedPositions > 0 ? true : false,
      lockerProgram: lockedPositions > 0 ? 'orca-native' : null,
      lockedPositions,
      totalPositions,
      lockedLiquidityUsd: null,
      quality: [],
    };

    cacheSet(cacheKeyStr, result, getTtlMs('medium'));
    return result;
  } catch (err) {
    circuitFailure(CB_KEY);
    return {
      ok: false,
      latencyMs: Date.now() - start,
      locked: null,
      lockerProgram: null,
      lockedPositions: 0,
      totalPositions: 0,
      lockedLiquidityUsd: null,
      error: String(err),
      quality: ['DEGRADED'],
    };
  }
}
