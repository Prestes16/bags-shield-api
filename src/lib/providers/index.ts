/**
 * Multi-source providers with fetchGuard, cache, and circuit breaker.
 */

export { fetchGuard, type FetchGuardOptions, type FetchGuardResult } from './fetchGuard';
export { circuitAllow, circuitFailure, circuitSuccess, circuitState } from './circuitBreaker';
export { cacheKey, cacheGet, cacheSet, getTtlMs, type TtlPreset } from './cache';
export { fetchHeliusAsset, type HeliusSourceResult } from './helius';
export { fetchBirdeyeTokenOverview, type BirdeyeSourceResult } from './birdeye';
export { fetchDexScreenerTokenPairs, type DexScreenerSourceResult } from './dexscreener';
export { fetchMeteoraPairsForMint, type MeteoraSourceResult } from './meteora';
export { fetchJupiterQuote, type JupiterQuoteParams, type JupiterQuoteResult } from './jupiter';
export { fetchJupiterSwap, type JupiterSwapParams, type JupiterSwapResult } from './jupiterSwap';

export type SourceMetaItem = {
  name: string;
  ok: boolean;
  latencyMs: number;
  fetchedAt: string;
  quality: string[];
  error?: string;
};
