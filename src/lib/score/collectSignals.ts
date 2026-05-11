/**
 * Build ScoreSignals from provider results (Helius, Birdeye, DexScreener, Meteora, Orca).
 * Normalizes and cross-checks; sets dataConflict when price/volume diverge.
 */

import type { ScoreSignals, PoolSignals, MarketSignals, ActorsSignals } from './signals';
import { DEFAULT_SIGNALS } from './signals';
import type { HeliusSourceResult } from '@/lib/providers/helius';
import type { BirdeyeSourceResult } from '@/lib/providers/birdeye';
import type { DexScreenerSourceResult } from '@/lib/providers/dexscreener';
import type { MeteoraSourceResult } from '@/lib/providers/meteora';
import type { OrcaLockCheckResult } from '@/lib/providers/orca';

const PRICE_DIVERGENCE_THRESHOLD = 0.25; // 25% diff â†’ conflict
const VOLUME_DIVERGENCE_THRESHOLD = 0.5; // 50% diff â†’ conflict

function safeNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function pickLiquidityUsd(p: unknown): unknown {
  if (!isRecord(p)) return undefined;
  const liq = p["liquidity"];
  if (typeof liq === "number") return liq;
  if (isRecord(liq)) return liq["usd"];
  return undefined;
}

function pickVolume24h(p: unknown): unknown {
  if (!isRecord(p)) return undefined;
  const vol = p["volume"];
  if (typeof vol === "number") return vol;
  if (isRecord(vol)) return vol["h24"];
  // fallback comum
  return p["volume24h"];
}

function unwrapBirdeyeData(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const inner = d.data && typeof d.data === 'object' ? (d.data as Record<string, unknown>) : d;
  return inner;
}

function extractBirdeyePrice(data: unknown): number | null {
  const d = unwrapBirdeyeData(data);
  if (!d) return null;
  const price = d.price ?? d.value;
  return safeNumber(price);
}

function extractBirdeyeLiquidity(data: unknown): number | null {
  const d = unwrapBirdeyeData(data);
  if (!d) return null;
  const liq = d.liquidity ?? d.liquidity_usd;
  return safeNumber(liq);
}

function extractBirdeyeVolume24h(data: unknown): number | null {
  const d = unwrapBirdeyeData(data);
  if (!d) return null;
  const v = d.v24h ?? d.volume24h ?? d.volume_24h;
  return safeNumber(v);
}

interface DexPairRaw {
  liquidity?: number;
  priceUsd?: number;
  volume?: number;
  dexId?: string;
  pairAddress?: string;
}

function extractDexScreenerPairs(data: unknown): DexPairRaw[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  const pairs = d.pairs ?? d;
  if (!Array.isArray(pairs)) return [];
  return pairs.map((p: Record<string, unknown>) => ({
    liquidity: safeNumber(pickLiquidityUsd(p)) ?? undefined,
    priceUsd: safeNumber(p.priceUsd ?? p.price) ?? undefined,
    volume: safeNumber(pickVolume24h(p)) ?? undefined,
    dexId: typeof p.dexId === 'string' ? p.dexId : typeof p.dex_id === 'string' ? p.dex_id : undefined,
    pairAddress: typeof p.pairAddress === 'string' ? p.pairAddress : typeof p.pair_address === 'string' ? p.pair_address : undefined,
  }));
}

function extractDexScreenerAggregates(pairs: Array<{ liquidity?: number; priceUsd?: number; volume?: number }>): {
  liquidity: number | null;
  priceUsd: number | null;
  volume24h: number | null;
} {
  if (pairs.length === 0) return { liquidity: null, priceUsd: null, volume24h: null };
  const liquidity = pairs.reduce((s, p) => s + (p.liquidity ?? 0), 0) || null;
  const priceUsd = pairs[0]?.priceUsd ?? null;
  const volume24h = pairs.reduce((s, p) => s + (p.volume ?? 0), 0) || null;
  return { liquidity: liquidity ?? null, priceUsd, volume24h };
}

/** Map DexScreener dexId to our pool type + a direct explorer URL */
function dexIdToTypeAndUrl(dexId: string | undefined, address: string): {
  type: PoolSignals['type'];
  url: string | null;
} {
  const id = (dexId ?? '').toLowerCase();
  if (id === 'orca' || id.includes('orca')) {
    return { type: 'orca', url: address ? `https://www.orca.so/pools?address=${address}` : null };
  }
  if (id === 'meteora' || id.includes('meteora') || id === 'meteora-dlmm') {
    return { type: 'meteora', url: address ? `https://app.meteora.ag/pools/${address}` : null };
  }
  if (id === 'raydium' || id.includes('raydium')) {
    return { type: 'raydium', url: address ? `https://raydium.io/liquidity/increase/?ammId=${address}` : null };
  }
  return { type: 'unknown', url: null };
}

function extractMeteoraPools(data: unknown[]): PoolSignals[] {
  if (!Array.isArray(data)) return [];
  return data.map((p: Record<string, unknown>) => {
    const address = String(p.address ?? p.pair_address ?? '');
    return {
      type: 'meteora' as const,
      address,
      liquidity: safeNumber(p.liquidity ?? p.liquidity_usd) ?? 0,
      lpLocked: null,
      url: address ? `https://app.meteora.ag/pools/${address}` : null,
      evidence: {},
    };
  });
}

function extractDexScreenerPools(data: unknown): PoolSignals[] {
  const pairs = extractDexScreenerPairs(data);
  return pairs
    .filter((p) => p.pairAddress && p.pairAddress.length >= 32) // skip fake/missing addresses
    .map((p) => {
      const address = p.pairAddress!;
      const { type, url } = dexIdToTypeAndUrl(p.dexId, address);
      return {
        type,
        address,
        liquidity: p.liquidity ?? 0,
        lpLocked: null,
        url,
        evidence: {},
      };
    });
}

export interface ProviderResults {
  helius: HeliusSourceResult;
  birdeye: BirdeyeSourceResult;
  dexscreener: DexScreenerSourceResult;
  meteora: MeteoraSourceResult;
  /** Optional — undefined when Orca check was skipped or not yet wired */
  orca?: OrcaLockCheckResult;
}

export function collectSignals(mint: string, results: ProviderResults): ScoreSignals {
  const signals: ScoreSignals = {
    ...DEFAULT_SIGNALS,
    market: { ...DEFAULT_SIGNALS.market },
    pools: [],
    actors: { ...DEFAULT_SIGNALS.actors },
    evidence: {},
  };
  const sources: string[] = [];
  let sourcesOk = 0;

  if (results.helius.ok && results.helius.data) {
    sourcesOk++;
    sources.push('helius');
    const res = results.helius.data.result as Record<string, unknown> | undefined;
    if (res && typeof res === 'object') {
      const content = res.content as { metadata?: { mint?: string } } | undefined;
      const frozen = res.frozen as boolean | undefined;
      signals.mintActive = frozen === true ? false : true;
      signals.evidence.helius = res;
    }
  }
  signals.sourcesTotal++;

  if (results.birdeye.ok && results.birdeye.data) {
    sourcesOk++;
    sources.push('birdeye');
    signals.evidence.birdeye = results.birdeye.data;
  }
  signals.sourcesTotal++;

  if (results.dexscreener.ok && results.dexscreener.data) {
    sourcesOk++;
    sources.push('dexscreener');
    signals.evidence.dexscreener = results.dexscreener.data;
  }
  signals.sourcesTotal++;
  const meteoraDisabled = (Array.isArray(results.meteora.quality) && results.meteora.quality.includes('DISABLED')) || /disabled/i.test(String(results.meteora.error ?? ''));

  if (!meteoraDisabled) {
    if (results.meteora.ok && results.meteora.data) {
      sourcesOk++;
      sources.push('meteora');
      signals.evidence.meteora = results.meteora.data;
    }
    signals.sourcesTotal++;
  }

  signals.sourcesOk = sourcesOk;
  signals.market.sourcesUsed = sources;

  const birdeyePrice = results.birdeye.ok ? extractBirdeyePrice(results.birdeye.data) : null;
  const birdeyeLiq = results.birdeye.ok ? extractBirdeyeLiquidity(results.birdeye.data) : null;
  const birdeyeVol = results.birdeye.ok ? extractBirdeyeVolume24h(results.birdeye.data) : null;

  const dsPairs = results.dexscreener.ok ? extractDexScreenerPairs(results.dexscreener.data) : [];
  const dsAgg = extractDexScreenerAggregates(dsPairs);

  let priceUsd = birdeyePrice ?? dsAgg.priceUsd;
  let liquidityUsd = birdeyeLiq ?? dsAgg.liquidity;
  let volume24hUsd = birdeyeVol ?? dsAgg.volume24h;

  if (dsAgg.liquidity !== null && (liquidityUsd === null || dsAgg.liquidity > (liquidityUsd ?? 0))) {
    liquidityUsd = dsAgg.liquidity;
  }
  if (dsAgg.volume24h !== null && (volume24hUsd === null || dsAgg.volume24h > (volume24hUsd ?? 0))) {
    volume24hUsd = dsAgg.volume24h;
  }

  signals.market.priceUsd = priceUsd;
  signals.market.liquidityUsd = liquidityUsd;
  signals.market.volume24hUsd = volume24hUsd;

  let dataConflict = false;
  if (
    birdeyePrice != null &&
    dsAgg.priceUsd != null &&
    Math.abs(birdeyePrice - dsAgg.priceUsd) / Math.max(birdeyePrice, dsAgg.priceUsd, 1e-9) > PRICE_DIVERGENCE_THRESHOLD
  ) {
    dataConflict = true;
  }
  if (
    birdeyeVol != null &&
    dsAgg.volume24h != null &&
    Math.abs(birdeyeVol - dsAgg.volume24h) / Math.max(birdeyeVol, dsAgg.volume24h, 1) > VOLUME_DIVERGENCE_THRESHOLD
  ) {
    dataConflict = true;
  }
  signals.dataConflict = dataConflict;

  const meteoraPools =
    results.meteora.ok && Array.isArray(results.meteora.data) ? extractMeteoraPools(results.meteora.data) : [];
  const dsPools = results.dexscreener.ok ? extractDexScreenerPools(results.dexscreener.data) : [];

  // Merge: DexScreener first (may cover Orca/Raydium), then Meteora enriches/adds.
  // Meteora entries take precedence for their addresses (more accurate liquidity).
  // Deduplicate by address, then take top 3 by liquidity.
  const poolMap = new Map<string, PoolSignals>();
  dsPools.forEach((p) => { if (p.address) poolMap.set(p.address, p); });
  meteoraPools.forEach((p) => { if (p.address) poolMap.set(p.address, p); }); // overrides DS for same address
  signals.pools = Array.from(poolMap.values())
    .sort((a, b) => b.liquidity - a.liquidity)
    .slice(0, 3);

  // Orca LP lock enrichment
  const orca = results.orca;
  if (orca?.ok && orca.locked !== null) {
    // Mark all Orca pools in the pool list as locked/unlocked
    for (const pool of signals.pools) {
      // DexScreener pools don't have a reliable type tag yet - mark all if Orca confirms
      if (pool.lpLocked === null) {
        pool.lpLocked = orca.locked;
      }
    }

    // If any lock is confirmed, surface the lock seconds (unknown duration = 1 day sentinel)
    if (orca.locked && signals.lpLockSeconds === null) {
      // We don't have expiry from PDA check yet; flag as locked with unknown duration
      signals.lpLockSeconds = -1; // -1 = locked, duration unknown
    }

    // If DexScreener provided a concrete locked USD amount, store in evidence
    if (orca.lockedLiquidityUsd !== null) {
      (signals.evidence as Record<string, unknown>).orcaLockedUsd = orca.lockedLiquidityUsd;
    }
    (signals.evidence as Record<string, unknown>).orcaLock = {
      locked: orca.locked,
      lockerProgram: orca.lockerProgram,
      lockedPositions: orca.lockedPositions,
      totalPositions: orca.totalPositions,
    };
  }

  return signals;
}
