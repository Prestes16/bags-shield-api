/**
 * Scan upstreams: Helius, DexScreener, Birdeye, Meteora.
 * Todos tratados por igual: Promise.allSettled, timeouts, nenhum quebra o outro.
 */

import { getHeliusRpcUrl } from '@/lib/helius';

const UPSTREAM_TIMEOUT_MS = 4_000;

export type UpstreamStatus = 'ok' | 'down' | 'timeout' | '401' | '403' | '429' | '5xx';

function toUpstreamStatus(status: number): UpstreamStatus {
  if (status === 401) return '401';
  if (status === 403) return '403';
  if (status === 429) return '429';
  if (status === 408) return 'timeout';
  if (status >= 500 || status === 0) return '5xx';
  if (status >= 200 && status < 300) return 'ok';
  return 'down';
}

export interface UpstreamResult<T = unknown> {
  status: UpstreamStatus;
  data?: T;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = UPSTREAM_TIMEOUT_MS,
): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    clearTimeout(timer);
    return { ok: res.ok, status: res.status, text };
  } catch (e) {
    clearTimeout(timer);
    const err = e as { name?: string; code?: string };
    if (err?.name === 'AbortError') {
      return { ok: false, status: 408, text: 'timeout' };
    }
    return { ok: false, status: 0, text: String(e) };
  }
}

/** Helius DAS getAsset */
async function fetchHelius(mint: string): Promise<UpstreamResult> {
  const rpcUrl = getHeliusRpcUrl();
  if (!rpcUrl) return { status: 'down' };

  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 'scan',
    method: 'getAsset',
    params: { id: mint },
  });

  const { ok, status, text } = await fetchWithTimeout(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body,
  });

  if (status === 401 || status === 403) {
    return { status: status === 401 ? '401' : '403' };
  }
  if (!ok || status >= 500 || status === 0 || status === 408) {
    return { status: toUpstreamStatus(status) };
  }

  try {
    const json = JSON.parse(text);
    if (json?.error && (json.error.code === -32401 || /invalid api key/i.test(String(json.error?.message ?? '')))) {
      return { status: '401' };
    }
    return { status: 'ok', data: json };
  } catch {
    return { status: 'down' };
  }
}

/** DexScreener: token-pairs (pools do token) */
async function fetchDexScreener(mint: string): Promise<UpstreamResult> {
  const url = `https://api.dexscreener.com/token-pairs/v1/solana/${mint}`;
  const { ok, status, text } = await fetchWithTimeout(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!ok || status >= 400) return { status: toUpstreamStatus(status) };
  try {
    const data = JSON.parse(text);
    return { status: 'ok', data };
  } catch {
    return { status: 'down' };
  }
}

/** Birdeye: token_overview (requer BIRDEYE_API_KEY) */
async function fetchBirdeye(mint: string): Promise<UpstreamResult> {
  const key = (process.env.BIRDEYE_API_KEY ?? '').trim();
  if (!key || key.length < 20) return { status: 'down' };

  const url = `https://public-api.birdeye.so/defi/token_overview?address=${encodeURIComponent(mint)}`;
  const { ok, status, text } = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'x-chain': 'solana',
      'X-API-KEY': key,
    },
  });

  if (status === 401 || status === 403) return { status: status === 401 ? '401' : '403' };
  if (!ok || status >= 400) return { status: toUpstreamStatus(status) };
  try {
    const data = JSON.parse(text);
    return { status: 'ok', data };
  } catch {
    return { status: 'down' };
  }
}

/** Meteora DLMM: pair/all e filtrar por token (ou token-pairs se houver) */
async function fetchMeteora(mint: string): Promise<UpstreamResult> {
  const url = 'https://dlmm-api.meteora.ag/pair/all';
  const { ok, status, text } = await fetchWithTimeout(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!ok || status >= 400) return { status: toUpstreamStatus(status) };
  try {
    const pairs = JSON.parse(text);
    const arr = Array.isArray(pairs) ? pairs : [];
    const filtered = arr.filter(
      (p: { baseMint?: string; quoteMint?: string }) => p?.baseMint === mint || p?.quoteMint === mint,
    );
    return { status: 'ok', data: filtered };
  } catch {
    return { status: 'down' };
  }
}

export interface ScanUpstreamsResult {
  helius: UpstreamResult;
  dexscreener: UpstreamResult;
  birdeye: UpstreamResult;
  meteora: UpstreamResult;
  degraded: boolean;
}

/**
 * Chama Helius, DexScreener, Birdeye e Meteora em paralelo.
 * Promise.allSettled garante que falha de um não quebra os outros.
 */
export async function fetchAllUpstreams(mint: string): Promise<ScanUpstreamsResult> {
  const [heliusR, dexscreenerR, birdeyeR, meteoraR] = await Promise.allSettled([
    fetchHelius(mint),
    fetchDexScreener(mint),
    fetchBirdeye(mint),
    fetchMeteora(mint),
  ]);

  const helius = heliusR.status === 'fulfilled' ? heliusR.value : { status: 'down' as const };
  const dexscreener = dexscreenerR.status === 'fulfilled' ? dexscreenerR.value : { status: 'down' as const };
  const birdeye = birdeyeR.status === 'fulfilled' ? birdeyeR.value : { status: 'down' as const };
  const meteora = meteoraR.status === 'fulfilled' ? meteoraR.value : { status: 'down' as const };

  const degraded = dexscreener.status !== 'ok' || birdeye.status !== 'ok' || meteora.status !== 'ok';

  return { helius, dexscreener, birdeye, meteora, degraded };
}

/** Formata header x-bs-upstreams a partir do resultado */
export function formatUpstreamsHeader(r: ScanUpstreamsResult): string {
  const h = r.helius.status;
  const d = r.dexscreener.status === 'ok' ? 'ok' : 'down';
  const b = r.birdeye.status === 'ok' ? 'ok' : 'down';
  const m = r.meteora.status === 'ok' ? 'ok' : 'down';
  return `helius=${h}; dexscreener=${d}; birdeye=${b}; meteora=${m}`;
}
