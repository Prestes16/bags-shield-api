/**
 * Jupiter provider: quote (and optional swap params). Uses fetchGuard + circuit breaker + cache.
 * Server only assists with quote/route and validation; client signs and sends tx.
 */

import { fetchGuard } from './fetchGuard';
import { circuitAllow, circuitFailure, circuitSuccess } from './circuitBreaker';
import { cacheGet, cacheSet, cacheKey, getTtlMs } from './cache';

const PROVIDER = 'jupiter';
const CB_KEY = 'jupiter:quote';
const BASE = 'https://lite-api.jup.ag/swap/v1';

export interface JupiterQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
}

export interface JupiterQuoteResult {
  ok: boolean;
  latencyMs: number;
  data?: unknown;
  error?: string;
  quality: string[];
}

export async function fetchJupiterQuote(params: JupiterQuoteParams): Promise<JupiterQuoteResult> {
  const { inputMint, outputMint, amount, slippageBps = 50 } = params;
  const cacheKeyStr = cacheKey(PROVIDER, 'quote', {
    inputMint,
    outputMint,
    amount: amount.slice(0, 20),
    slippage: String(slippageBps),
  });
  const ttl = getTtlMs('short');

  const cached = cacheGet<unknown>(cacheKeyStr);
  if (cached.hit) {
    return { ok: true, latencyMs: 0, data: cached.data, quality: ['CACHE_HIT'] };
  }

  if (!circuitAllow(CB_KEY)) {
    return { ok: false, latencyMs: 0, error: 'Circuit open', quality: ['DEGRADED'] };
  }

  const search = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: String(slippageBps),
  });
  const url = `${BASE}/quote?${search.toString()}`;

  const result = await fetchGuard<unknown>(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    timeoutMs: 10_000,
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
