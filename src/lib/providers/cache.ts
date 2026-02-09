/**
 * In-memory cache with TTL per key.
 * Key = provider + method + normalized params (e.g. mint).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export type TtlPreset = 'short' | 'medium' | 'long';

const TTL_MS: Record<TtlPreset, number> = {
  short: 15_000, // 15s - price/quote
  medium: 5 * 60_000, // 5 min - holders/creators
  long: 6 * 60 * 60_000, // 6h - metadata
};

export function cacheKey(provider: string, method: string, params: Record<string, string>): string {
  const parts = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`);
  return `provider:${provider}:${method}:${parts.join('&')}`;
}

export function cacheGet<T>(key: string): { hit: true; data: T } | { hit: false } {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return { hit: false };
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return { hit: false };
  }
  return { hit: true, data: entry.data };
}

export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

export function getTtlMs(preset: TtlPreset): number {
  return TTL_MS[preset];
}
