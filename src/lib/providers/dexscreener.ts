/**
 * DexScreener provider: token-pairs. Uses fetchGuard + circuit breaker + cache.
 */

import { fetchGuard } from './fetchGuard';
import { circuitAllow, circuitFailure, circuitSuccess } from './circuitBreaker';
import { cacheGet, cacheSet, cacheKey, getTtlMs } from './cache';

const PROVIDER = 'dexscreener';
const CB_KEY = 'dexscreener:token_pairs';
const BASE = 'https://api.dexscreener.com';

export interface DexScreenerSourceResult {
  ok: boolean;
  latencyMs: number;
  data?: unknown;
  error?: string;
  quality: string[];
}

export async function fetchDexScreenerTokenPairs(mint: string): Promise<DexScreenerSourceResult> {
  const cacheKeyStr = cacheKey(PROVIDER, 'token_pairs', { mint });
  const ttl = getTtlMs('short');

  const cached = cacheGet<unknown>(cacheKeyStr);
  if (cached.hit) {
    return { ok: true, latencyMs: 0, data: cached.data, quality: ['CACHE_HIT'] };
  }

  if (!circuitAllow(CB_KEY)) {
    return { ok: false, latencyMs: 0, error: 'Circuit open', quality: ['DEGRADED'] };
  }

  const url = `${BASE}/token-pairs/v1/solana/${mint}`;

  const result = await fetchGuard<unknown>(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    timeoutMs: 6_000,
  });

  if (result.ok && result.data !== undefined) {
    circuitSuccess(CB_KEY);
    cacheSet(cacheKeyStr, result.data, ttl);
    return { ok: true, latencyMs: result.latencyMs, data: result.data, quality: [] };
  }

  circuitFailure(CB_KEY);
  return {
    ok: false,
    latencyMs: result.latencyMs,
    error: result.error ?? `HTTP ${result.status}`,
    quality: result.timedOut ? ['TIMEOUT'] : ['DEGRADED'],
  };
}
