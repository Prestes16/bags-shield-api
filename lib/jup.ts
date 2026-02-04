/**
 * Jupiter API client (v0 - Metis Integration)
 * Client HTTP simplificado para integração Jupiter Swap API
 */

type JupConfig = {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
};

function mustEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getCfg(): JupConfig {
  return {
    baseUrl: process.env.JUP_API_BASE?.trim() || 'https://api.jup.ag',
    apiKey: mustEnv('JUP_API_KEY'),
    timeoutMs: Number(process.env.JUP_TIMEOUT_MS || '15000'),
  };
}

async function jupFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cfg = getCfg();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const res = await fetch(`${cfg.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        // >>>>>> COLE A CHAVE NO ENV (NÃO AQUI) <<<<<<
        'x-api-key': cfg.apiKey,
        ...(init?.headers || {}),
      },
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {}

    if (!res.ok) {
      const msg = json?.error || json?.message || text || `HTTP ${res.status}`;
      throw new Error(`JUP ${res.status}: ${msg}`);
    }

    return json as T;
  } finally {
    clearTimeout(t);
  }
}

// Tipos mínimos (v0). A gente refina depois.
export type QuoteRequest = {
  inputMint: string;
  outputMint: string;
  amount: string; // em unidades do mint (string pra não estourar)
  slippageBps?: number;
  swapMode?: 'ExactIn' | 'ExactOut';
  platformFeeBps?: number; // fee integrador
};

export async function getQuote(q: QuoteRequest) {
  const params = new URLSearchParams();
  params.set('inputMint', q.inputMint);
  params.set('outputMint', q.outputMint);
  params.set('amount', q.amount);
  if (q.slippageBps != null) params.set('slippageBps', String(q.slippageBps));
  if (q.swapMode) params.set('swapMode', q.swapMode);
  if (q.platformFeeBps != null) params.set('platformFeeBps', String(q.platformFeeBps));

  return jupFetch<any>(`/swap/v1/quote?${params.toString()}`, { method: 'GET' });
}

export type SwapRequest = {
  quoteResponse: any; // retornado pelo quote
  userPublicKey: string; // wallet do user
  wrapAndUnwrapSol?: boolean;
  feeAccount?: string; // token account pra coletar fee
  trackingAccount?: string; // pubkey pra tracking
};

export async function postSwap(body: SwapRequest) {
  return jupFetch<any>(`/swap/v1/swap`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
