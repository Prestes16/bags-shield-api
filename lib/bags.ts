type Creator = { address: string; share: number };

function pick<T>(x: any, ...path: string[]): T | undefined {
  let cur = x;
  for (const k of path) cur = cur?.[k];
  return cur as T | undefined;
}

function toBaseUrl(s: string) {
  return s.replace(/\/+$/, "");
}

async function fetchJson(url: string, ms = Number(process.env.BAGS_TIMEOUT_MS ?? 5000)) {
  const f: any = (globalThis as any).fetch;
  if (!f) return undefined;
  const ac = typeof AbortController !== "undefined" ? new AbortController() : undefined;
  const timer = ac ? setTimeout(() => ac.abort(), ms) : undefined;
  try {
    const r = await f(url, ac ? { signal: ac.signal } : undefined);
    if (!r.ok) return undefined;
    return await r.json();
  } catch {
    return undefined;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getTokenCreators(mint: string): Promise<Creator[]> {
  const base = process.env.BAGS_API_BASE?.trim();
  if (!base) return [];
  const url = toBaseUrl(base) + `/token/${encodeURIComponent(mint)}/creators`;
  const j = await fetchJson(url);
  const arr = (Array.isArray(j?.creators) ? j?.creators
             : Array.isArray(pick<any[]>(j, "response", "creators")) ? pick<any[]>(j, "response", "creators")
             : []) as any[];
  const mapped = (arr ?? []).map((c: any) => ({
    address: String(c?.address ?? c?.pubkey ?? ""),
    share: Number(c?.share ?? c?.percent ?? 0),
  })).filter(c => c.address && Number.isFinite(c.share));
  return mapped;
}

export async function getLifetimeFeesLamports(mint: string): Promise<number> {
  const base = process.env.BAGS_API_BASE?.trim();
  if (!base) return 0;
  const url = toBaseUrl(base) + `/token/${encodeURIComponent(mint)}/lifetime-fees`;
  const j = await fetchJson(url);
  const fee = pick<number>(j, "lifetimeFees", "total")
          ?? pick<number>(j, "response", "lifetimeFees", "total")
          ?? 0;
  return Number.isFinite(fee) ? fee : 0;
}