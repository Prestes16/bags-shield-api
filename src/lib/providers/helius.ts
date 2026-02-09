/**
 * Helius provider: DAS getAsset via RPC. Uses fetchGuard + circuit breaker + cache.
 */

import { getHeliusRpcUrl } from '@/lib/helius';
import { fetchGuard } from './fetchGuard';
import { circuitAllow, circuitFailure, circuitSuccess } from './circuitBreaker';
import { cacheGet, cacheSet, cacheKey, getTtlMs, TtlPreset } from './cache';

const PROVIDER = 'helius';
const CB_KEY = 'helius:getAsset';

export interface HeliusAssetResult {
  result?: unknown;
  error?: { code?: number; message?: string };
}

export interface HeliusSourceResult {
  ok: boolean;
  latencyMs: number;
  data?: HeliusAssetResult;
  error?: string;
  quality: string[];
}

export async function fetchHeliusAsset(mint: string): Promise<HeliusSourceResult> {
  const key = cacheKey(PROVIDER, 'getAsset', { mint });
  const ttl = getTtlMs('medium');

  const cached = cacheGet<HeliusAssetResult>(key);
  if (cached.hit) {
    return { ok: true, latencyMs: 0, data: cached.data, quality: ['CACHE_HIT'] };
  }

  if (!circuitAllow(CB_KEY)) {
    return { ok: false, latencyMs: 0, error: 'Circuit open', quality: ['DEGRADED'] };
  }

  const rpcUrl = getHeliusRpcUrl();
  if (!rpcUrl) {
    return { ok: false, latencyMs: 0, error: 'Helius not configured', quality: ['DEGRADED'] };
  }

  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 'scan',
    method: 'getAsset',
    params: { id: mint },
  });

  const result = await fetchGuard<HeliusAssetResult>(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body,
    timeoutMs: 8_000,
    validate: (data) => {
      if (data && typeof data === 'object' && 'error' in data) {
        const err = (data as { error?: { code?: number; message?: string } }).error;
        if (err && (err.code === -32401 || /invalid api key/i.test(String(err.message ?? ''))))
          return { ok: false, error: 'Invalid API key' };
      }
      return { ok: true };
    },
  });

  if (result.ok && result.data) {
    circuitSuccess(CB_KEY);
    cacheSet(key, result.data, ttl);
    return {
      ok: true,
      latencyMs: result.latencyMs,
      data: result.data,
      quality: [],
    };
  }

  circuitFailure(CB_KEY);
  return {
    ok: false,
    latencyMs: result.latencyMs,
    error: result.error ?? `HTTP ${result.status}`,
    quality: result.timedOut ? ['TIMEOUT'] : ['DEGRADED'],
  };
}
