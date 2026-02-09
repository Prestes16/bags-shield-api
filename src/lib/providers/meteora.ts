/**
 * Meteora provider: DLMM pair/all, filter by mint. Uses fetchGuard + circuit breaker + cache.
 */

import { fetchGuard } from './fetchGuard';
import { circuitAllow, circuitFailure, circuitSuccess } from './circuitBreaker';
import { cacheGet, cacheSet, cacheKey, getTtlMs } from './cache';

const PROVIDER = 'meteora';
const CB_KEY = 'meteora:pair_all';
const BASE = 'https://dlmm-api.meteora.ag';

export interface MeteoraSourceResult {
  ok: boolean;
  latencyMs: number;
  data?: unknown[];
  error?: string;
  quality: string[];
}

export async function fetchMeteoraPairsForMint(mint: string): Promise<MeteoraSourceResult> {
  const cacheKeyStr = cacheKey(PROVIDER, 'pair_all', { mint: 'all' });
  const ttl = getTtlMs('medium');

  const cached = cacheGet<unknown[]>(cacheKeyStr);
  if (cached.hit && Array.isArray(cached.data)) {
    const filtered = cached.data.filter(
      (p: { baseMint?: string; quoteMint?: string }) => p?.baseMint === mint || p?.quoteMint === mint,
    );
    return { ok: true, latencyMs: 0, data: filtered, quality: ['CACHE_HIT'] };
  }

  if (!circuitAllow(CB_KEY)) {
    return { ok: false, latencyMs: 0, error: 'Circuit open', quality: ['DEGRADED'] };
  }

  const url = `${BASE}/pair/all`;

  const result = await fetchGuard<unknown>(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    timeoutMs: 8_000,
    validate: (data) => (Array.isArray(data) ? { ok: true as const } : { ok: false as const, error: 'Not array' }),
  });

  if (result.ok && Array.isArray(result.data)) {
    circuitSuccess(CB_KEY);
    cacheSet(cacheKeyStr, result.data, ttl);
    const filtered = result.data.filter(
      (p: { baseMint?: string; quoteMint?: string }) => p?.baseMint === mint || p?.quoteMint === mint,
    );
    return { ok: true, latencyMs: result.latencyMs, data: filtered, quality: [] };
  }

  circuitFailure(CB_KEY);
  return {
    ok: false,
    latencyMs: result.latencyMs ?? 0,
    error: result.error ?? `HTTP ${result.status}`,
    quality: result.timedOut ? ['TIMEOUT'] : ['DEGRADED'],
  };
}
