export type BagsClientConfig = {
  baseUrl?: string;
  timeoutMs?: number;
  apiKey?: string;
  allowMockFallback?: boolean;
};

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
const jitter = (ms: number) => Math.round(ms * (0.875 + Math.random() * 0.25)); // 87.5%–112.5%

function resolveBaseFromEnv(): string | undefined {
  const raw = (process.env.BAGS_API_BASE_OVERRIDE ?? process.env.BAGS_API_BASE ?? '').trim();
  if (!raw) return undefined;
  const fixed = raw.replace(/\/_mock\b/, '/mock').trim();
  return fixed || undefined;
}

function resolveBool(v: any): boolean {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

export function envConfigFromProcess(): BagsClientConfig {
  return {
    baseUrl: resolveBaseFromEnv(),
    timeoutMs: Number(process.env.BAGS_TIMEOUT_MS || '5000') || 5000,
    apiKey: process.env.BAGS_API_KEY || undefined,
    allowMockFallback: resolveBool(process.env.BAGS_ALLOW_MOCK_FALLBACK),
  };
}

export async function fetchJsonWithRetry(
  input: string,
  init: (RequestInit & { timeoutMs?: number; retries?: number }) = {}
) {
  const { timeoutMs = 5000, retries = 2, ...rest } = init;
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(new Error('timeout')), timeoutMs);
    try {
      const res = await fetch(input, { ...rest, signal: ctrl.signal });
      const retryable = res.status >= 500 || res.status === 429;
      const data: any = await res.json().catch(() => ({}));
      const headersAny: any = {};
      try { (res as any).headers?.forEach?.((v:any,k:any)=>headersAny[k]=v); } catch {}
      const upstreamRequestId = headersAny['x-request-id'] || (data?.meta?.requestId ?? null);
      if (!res.ok && retryable && attempt < retries) {
        const backoff = jitter(200 * Math.pow(2, attempt));
        await sleep(backoff);
        continue;
      }
      return { ok: res.ok, status: res.status, data, headers: headersAny, upstreamRequestId };
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const backoff = jitter(200 * Math.pow(2, attempt));
        await sleep(backoff);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr;
}

function withSlash(base: string) {
  return base.endsWith('/') ? base : (base + '/');
}

function isMockBase(base: string) {
  return /\/mock\/?$/.test(base);
}

function shouldFallback(status: number) {
  return status === 404 || status === 501 || status >= 500;
}

export async function getTokenInfo(mint: string, cfg?: BagsClientConfig) {
  const env = envConfigFromProcess();
  const base = (cfg?.baseUrl ?? env.baseUrl ?? '').trim();

  if (!base) {
    return {
      ok: false,
      status: 501,
      data: { error: { code: 'NOT_CONFIGURED', message: 'BAGS_API_BASE não configurado' } }
    };
  }

  const primaryBase = withSlash(base);
  const headers: Record<string,string> = { accept: 'application/json' };
  if (cfg?.apiKey ?? env.apiKey) headers['authorization'] = 'Bearer ' + (cfg?.apiKey ?? env.apiKey);

  // 1ª tentativa: base “real”
  const u1 = new URL('token-info', primaryBase);
  u1.searchParams.set('mint', mint);
  const r1 = await fetchJsonWithRetry(u1.toString(), { headers, timeoutMs: (cfg?.timeoutMs ?? env.timeoutMs) });
  if (r1.ok) return r1;

  // fallback opcional para /mock
  const allowFallback = cfg?.allowMockFallback ?? !!env.allowMockFallback;
  if (allowFallback && !isMockBase(primaryBase) && shouldFallback(r1.status)) {
    const mockBase = withSlash(primaryBase + 'mock');
    const u2 = new URL('token-info', mockBase);
    u2.searchParams.set('mint', mint);
    const r2 = await fetchJsonWithRetry(u2.toString(), { headers, timeoutMs: (cfg?.timeoutMs ?? env.timeoutMs) });
    return r2;
  }

  return r1;
}