/**
 * fetchGuard: timeout, retry (429/5xx), response size limit, optional schema validation.
 * All external provider calls should go through this.
 */

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB
const RETRY_MAX = 2;
const RETRY_DELAY_MS = 500;

export interface FetchGuardOptions {
  timeoutMs?: number;
  maxResponseBytes?: number;
  retries?: number;
  retryDelayMs?: number;
  validate?: (data: unknown) => { ok: true } | { ok: false; error: string };
  signal?: AbortSignal | null;
}

export interface FetchGuardResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  latencyMs: number;
  timedOut?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout, optional retry on 429/5xx, size limit, and optional schema validation.
 */
export async function fetchGuard<T = unknown>(
  url: string,
  options: RequestInit & FetchGuardOptions = {},
): Promise<FetchGuardResult<T>> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxResponseBytes = MAX_RESPONSE_BYTES,
    retries = RETRY_MAX,
    retryDelayMs = RETRY_DELAY_MS,
    validate,
    signal: externalSignal,
    ...fetchInit
  } = options;

  const start = Date.now();
  let lastStatus = 0;
  let lastError: string | undefined;
  let lastTimedOut = false;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...fetchInit, signal: controller.signal });
      clearTimeout(timeout);
      lastStatus = res.status;

      const contentType = res.headers.get('content-type') ?? '';
      const isJson = contentType.includes('application/json');

      if (!res.ok) {
        const text = await res.text().then((t) => t.slice(0, 500));
        lastError = `HTTP ${res.status}: ${text.slice(0, 100)}`;
        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }
        return {
          ok: false,
          status: res.status,
          error: lastError,
          latencyMs: Date.now() - start,
        };
      }

      const raw = await res.text();
      if (raw.length > maxResponseBytes) {
        return {
          ok: false,
          status: 413,
          error: 'Response too large',
          latencyMs: Date.now() - start,
        };
      }

      let data: unknown = raw;
      if (isJson) {
        try {
          data = JSON.parse(raw) as T;
        } catch {
          return {
            ok: false,
            status: 502,
            error: 'Invalid JSON',
            latencyMs: Date.now() - start,
          };
        }
      }

      if (validate) {
        const v = validate(data);
        if (!v.ok) {
          return {
            ok: false,
            status: 502,
            error: 'error' in v ? v.error : 'Validation failed',
            latencyMs: Date.now() - start,
          };
        }
      }

      return {
        ok: true,
        status: res.status,
        data: data as T,
        latencyMs: Date.now() - start,
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      const e = err as { name?: string; message?: string };
      if (e?.name === 'AbortError') {
        lastTimedOut = true;
        lastError = 'Timeout';
      } else {
        lastError = String(e?.message ?? err).slice(0, 200);
      }
      if (attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
      } else {
        return {
          ok: false,
          status: 0,
          error: lastError,
          latencyMs: Date.now() - start,
          timedOut: lastTimedOut,
        };
      }
    }
  }

  return {
    ok: false,
    status: lastStatus || 502,
    error: lastError ?? 'Unknown error',
    latencyMs: Date.now() - start,
    timedOut: lastTimedOut,
  };
}
