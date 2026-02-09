/**
 * Birdeye provider: token_overview. Uses fetchGuard + circuit breaker + cache.
 */

import { fetchGuard } from './fetchGuard';
import { circuitAllow, circuitFailure, circuitSuccess } from './circuitBreaker';
import { cacheGet, cacheSet, cacheKey, getTtlMs } from './cache';

const PROVIDER = 'birdeye';
const CB_KEY = 'birdeye:token_overview';
const BASE = 'https://public-api.birdeye.so';

function getApiKey(): string {
  return (process.env.BIRDEYE_API_KEY ?? '').trim();
}

export interface BirdeyeSourceResult {
  ok: boolean;
  latencyMs: number;
  data?: unknown;
  error?: string;
  quality: string[];
}

export async function fetchBirdeyeTokenOverview(mint: string): Promise<BirdeyeSourceResult> {
  const apiKey = getApiKey();
  if (!apiKey || apiKey.length < 20) {
    return { ok: false, latencyMs: 0, error: 'BIRDEYE_API_KEY not set', quality: ['DEGRADED'] };
  }

  const cacheKeyStr = cacheKey(PROVIDER, 'token_overview', { mint });
  const ttl = getTtlMs('short');

  const cached = cacheGet<unknown>(cacheKeyStr);
  if (cached.hit) {
    return { ok: true, latencyMs: 0, data: cached.data, quality: ['CACHE_HIT'] };
  }

  if (!circuitAllow(CB_KEY)) {
    return { ok: false, latencyMs: 0, error: 'Circuit open', quality: ['DEGRADED'] };
  }

  const url = `${BASE}/defi/token_overview?address=${encodeURIComponent(mint)}`;

  const result = await fetchGuard<unknown>(url, {
    method: 'GET',
    headers: { Accept: 'application/json', 'x-chain': 'solana', 'X-API-KEY': apiKey },
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
