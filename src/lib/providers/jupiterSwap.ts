/**
 * Jupiter provider: swap (returns swapTransaction base64).
 * Important: server NEVER signs. Client wallet signs + sends.
 */
import { fetchGuard } from './fetchGuard';
import { circuitAllow, circuitFailure, circuitSuccess } from './circuitBreaker';

const CB_KEY = 'jupiter:swap';
const BASE = 'https://lite-api.jup.ag/swap/v1';

export interface JupiterSwapParams {
  quoteResponse: unknown;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  dynamicComputeUnitLimit?: boolean;
  prioritizationFeeLamports?: number | 'auto';
  asLegacyTransaction?: boolean;
}

export interface JupiterSwapResult {
  ok: boolean;
  latencyMs: number;
  data?: unknown;
  error?: string;
  quality: string[];
}

export async function fetchJupiterSwap(params: JupiterSwapParams): Promise<JupiterSwapResult> {
  if (!circuitAllow(CB_KEY)) {
    return { ok: false, latencyMs: 0, error: 'Circuit open', quality: ['DEGRADED'] };
  }

  const url = `${BASE}/swap`;
  const payload: any = {
    quoteResponse: params.quoteResponse,
    userPublicKey: params.userPublicKey,
    wrapAndUnwrapSol: params.wrapAndUnwrapSol ?? true,
    dynamicComputeUnitLimit: params.dynamicComputeUnitLimit ?? true,
    asLegacyTransaction: params.asLegacyTransaction ?? false,
  };

  if (params.prioritizationFeeLamports !== undefined) {
    payload.prioritizationFeeLamports = params.prioritizationFeeLamports;
  }

  const r = await fetchGuard<unknown>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    timeoutMs: 15_000,
  });

  if (r.ok && r.data !== undefined) {
    circuitSuccess(CB_KEY);
    return { ok: true, latencyMs: r.latencyMs, data: r.data, quality: [] };
  }

  circuitFailure(CB_KEY);
  return {
    ok: false,
    latencyMs: r.latencyMs,
    error: r.error ?? `HTTP ${r.status}`,
    quality: r.timedOut ? ['TIMEOUT'] : ['DEGRADED'],
  };
}

