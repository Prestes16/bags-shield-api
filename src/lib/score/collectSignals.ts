/**
 * Build ScoreSignals from provider results (Helius, Birdeye, DexScreener, Meteora).
 * Normalizes and cross-checks; sets dataConflict when price/volume diverge.
 */

import type { ScoreSignals, PoolSignals, MarketSignals, ActorsSignals } from './signals';
import { DEFAULT_SIGNALS } from './signals';
import type { HeliusSourceResult } from '@/lib/providers/helius';
import type { BirdeyeSourceResult } from '@/lib/providers/birdeye';
import type { DexScreenerSourceResult } from '@/lib/providers/dexscreener';
import type { MeteoraSourceResult } from '@/lib/providers/meteora';

const PRICE_DIVERGENCE_THRESHOLD = 0.25; // 25% diff → conflict
const VOLUME_DIVERGENCE_THRESHOLD = 0.5; // 50% diff → conflict

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

function extractDexScreenerPairs(data: unknown): Array<{ liquidity?: number; priceUsd?: number; volume?: number }> {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  const pairs = d.pairs ?? d;
  if (!Array.isArray(pairs)) return [];
  return pairs.map((p: Record<string, unknown>) => ({
    liquidity: safeNumber(pickLiquidityUsd(p)) ?? undefined,
    priceUsd: safeNumber(p.priceUsd ?? p.price) ?? undefined,
    volume: safeNumber(pickVolume24h(p)) ?? undefined,
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

function extractMeteoraPools(data: unknown[], mint: string): PoolSignals[] {
  if (!Array.isArray(data)) return [];
  return data.slice(0, 20).map((p: Record<string, unknown>) => ({
    type: 'meteora' as const,
    address: String(p.address ?? p.pair_address ?? ''),
    liquidity: safeNumber(p.liquidity ?? p.liquidity_usd) ?? 0,
    lpLocked: null,
    evidence: {},
  }));
}

function extractDexScreenerPools(data: unknown): PoolSignals[] {
  const pairs = extractDexScreenerPairs(data);
  return pairs.slice(0, 20).map((p, i) => ({
    type: 'unknown' as const,
    address: `pair-${i}`,
    liquidity: p.liquidity ?? 0,
    lpLocked: null,
    evidence: {},
  }));
}

export interface ProviderResults {
  helius: HeliusSourceResult;
  birdeye: BirdeyeSourceResult;
  dexscreener: DexScreenerSourceResult;
  meteora: MeteoraSourceResult;
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

  if (results.meteora.ok && results.meteora.data) {
    sourcesOk++;
    sources.push('meteora');
    signals.evidence.meteora = results.meteora.data;
  }
  signals.sourcesTotal++;

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
    results.meteora.ok && Array.isArray(results.meteora.data) ? extractMeteoraPools(results.meteora.data, mint) : [];
  const dsPools = results.dexscreener.ok ? extractDexScreenerPools(results.dexscreener.data) : [];
  const poolMap = new Map<string, PoolSignals>();
  meteoraPools.forEach((p) => poolMap.set(p.address, p));
  dsPools.forEach((p) => poolMap.set(p.address, p));
  signals.pools = Array.from(poolMap.values()).slice(0, 30);

  return signals;
}
