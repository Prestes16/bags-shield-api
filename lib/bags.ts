export type BagsClientConfig = {
  baseUrl?: string;
  timeoutMs?: number;
  apiKey?: string;
};

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
const jitter = (ms: number) => Math.round(ms * (0.875 + Math.random() * 0.25)); // 87.5%–112.5%

export async function fetchJsonWithRetry(input: string, init: (RequestInit & { timeoutMs?: number; retries?: number }) = {}) {
  const { timeoutMs = 5000, retries = 2, ...rest } = init;
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(new Error("timeout")), timeoutMs);
    try {
      const res = await fetch(input, { ...rest, signal: ctrl.signal });
      const retryable = res.status >= 500 || res.status === 429;
      const data = await res.json().catch(() => ({} as any));
      // Headers -> objeto simples (compat)
      const headersAny: any = {};
      try { (res as any).headers?.forEach?.((v:any,k:any)=>headersAny[k]=v); } catch {}
      const upstreamRequestId = headersAny["x-request-id"] || (data?.meta?.requestId ?? null);
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

function resolveBaseFromEnv(): string | undefined {
  const raw = (process.env.BAGS_API_BASE_OVERRIDE ?? process.env.BAGS_API_BASE ?? '').trim();
  if (!raw) return undefined;
  // Corrige legado: "_mock" -> "mock"
  const fixed = raw.replace(/\/_mock\b/, '/mock').trim();
  return fixed || undefined;
}

export function envConfigFromProcess(): BagsClientConfig {
  return {
    baseUrl: resolveBaseFromEnv(),
    timeoutMs: Number(process.env.BAGS_TIMEOUT_MS || "5000") || 5000,
    apiKey: process.env.BAGS_API_KEY || undefined,
  };
}

export async function getTokenInfo(mint: string, cfg: BagsClientConfig = envConfigFromProcess()) {
  if (!cfg.baseUrl) {
    return { ok: false, status: 501, data: { error: { code: "NOT_CONFIGURED", message: "BAGS_API_BASE não configurado" } } };
  }
  let base = cfg.baseUrl || "";
  if (!base.endsWith("/")) base += "/";
  const url = new URL("token-info", base);
  url.searchParams.set("mint", mint);
  const headers: Record<string,string> = { accept: "application/json" };
  if (cfg.apiKey) headers["authorization"] = `Bearer ${cfg.apiKey}`;
  const r = await fetchJsonWithRetry(url.toString(), { headers, timeoutMs: cfg.timeoutMs });
  return r;
}