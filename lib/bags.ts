import { CONFIG } from "./constants";

const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }
function backoffMs(attempt: number) {
  const min = CONFIG.BAGS_BACKOFF_MS_MIN;
  const max = CONFIG.BAGS_BACKOFF_MS_MAX;
  const raw = Math.min(max, min * Math.pow(2, attempt));
  const jitter = Math.random() * raw * 0.25;
  return Math.round(raw + jitter);
}
function toUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = CONFIG.BAGS_API_BASE;
  if (!base) throw new Error("BAGS_API_BASE ausente; forneça URL absoluta ou configure o ambiente.");
  const b = base.endsWith("/") ? base : base + "/";
  return new URL(path.replace(/^\/+/, ""), b).toString();
}

/**
 * bagsFetch: fetch com timeout, retries/backoff e headers padrão Bags.
 * - Define Accept: application/json
 * - Se houver chave: x-api-key e Authorization: Bearer <key>
 * - Re-tenta em erros de rede e 408/425/429/5xx
 */
export async function bagsFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = toUrl(path);
  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  headers.set("x-client", "bags-shield-api/1.0");
  if (CONFIG.BAGS_API_KEY) {
    headers.set("x-api-key", CONFIG.BAGS_API_KEY);
    headers.set("Authorization", `Bearer ${CONFIG.BAGS_API_KEY}`);
  }

  const attempts = CONFIG.BAGS_RETRIES + 1;

  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CONFIG.BAGS_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, headers, signal: ctrl.signal });
      clearTimeout(timer);
      if (RETRY_STATUSES.has(res.status) && i < attempts - 1) {
        await sleep(backoffMs(i));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (i < attempts - 1) {
        await sleep(backoffMs(i));
        continue;
      }
      throw err;
    }
  }
  throw new Error("bagsFetch: retries esgotados");
}

export interface BagsMeta {
  status: number;
  requestId?: string;
  rateLimitLimit?: number;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
  url: string;
}
export type BagsOk<T> = { success: true; response: T; meta: BagsMeta };
export type BagsErr = { success: false; error: string; meta: BagsMeta };
export type BagsResult<T> = BagsOk<T> | BagsErr;

function toInt(h: string | null | undefined) {
  const n = Number(h ?? "");
  return Number.isFinite(n) ? n : undefined;
}

/** bagsJson: retorna envelope { success, response|error, meta } já parseado */
export async function bagsJson<T = unknown>(path: string, init: RequestInit = {}): Promise<BagsResult<T>> {
  const res = await bagsFetch(path, init);
  let data: any;
  try { data = await res.json(); } catch { data = undefined; }
  const meta: BagsMeta = {
    status: res.status,
    requestId: res.headers.get("x-request-id") ?? undefined,
    rateLimitLimit: toInt(res.headers.get("x-ratelimit-limit")),
    rateLimitRemaining: toInt(res.headers.get("x-ratelimit-remaining")),
    rateLimitReset: toInt(res.headers.get("x-ratelimit-reset")),
    url: res.url,
  };
  if (res.ok) return { success: true, response: (data as T), meta };
  const error = (data && (data.error || data.message)) || `HTTP ${res.status}`;
  return { success: false, error, meta };
}