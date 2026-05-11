import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── In-memory cache (60s TTL) ────────────────────────────────────────────

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Rate limiting ────────────────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 30;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "public, s-maxage=30, stale-while-revalidate=60",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return {
    base: url.replace(/\/+$/, "") + "/rest/v1",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
  };
}

type Filter = "recent" | "top" | "verified" | "volume_asc" | "volume_desc";

interface LaunchRow {
  mint: string;
  name: string | null;
  symbol: string | null;
  created_at: string;
}

interface DexPair {
  chainId: string;
  baseToken?: { address?: string };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
}

interface EnrichedLaunch {
  mint: string;
  name: string | null;
  symbol: string | null;
  created_at: string;
  score: number | null;
  risk_level: string | null;
  volume24h: number | null;
  liquidityUsd: number | null;
  verified: boolean;
}

// ── DexScreener batch enrichment ─────────────────────────────────────────

async function enrichWithMarketData(
  launches: LaunchRow[]
): Promise<EnrichedLaunch[]> {
  const results: EnrichedLaunch[] = launches.map((l) => ({
    ...l,
    score: null,
    risk_level: null,
    volume24h: null,
    liquidityUsd: null,
    verified: false,
  }));

  // Batch DexScreener (max 30 addresses per call)
  const mints = launches.map((l) => l.mint);
  const batches: string[][] = [];
  for (let i = 0; i < mints.length; i += 30) {
    batches.push(mints.slice(i, i + 30));
  }

  const pairMap = new Map<string, { volume24h: number; liquidityUsd: number }>();

  for (const batch of batches) {
    const cacheKey = `dex:${batch.join(",")}`;
    const cached = getCached(cacheKey) as Map<string, { volume24h: number; liquidityUsd: number }> | null;
    if (cached) {
      for (const [k, v] of cached) pairMap.set(k, v);
      continue;
    }

    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${batch.join(",")}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const data = (await res.json()) as { pairs?: DexPair[] };
        const batchMap = new Map<string, { volume24h: number; liquidityUsd: number }>();
        for (const pair of data.pairs ?? []) {
          if (pair.chainId !== "solana") continue;
          const addr = pair.baseToken?.address;
          if (!addr) continue;
          const existing = batchMap.get(addr);
          const vol = pair.volume?.h24 ?? 0;
          const liq = pair.liquidity?.usd ?? 0;
          if (!existing || liq > existing.liquidityUsd) {
            batchMap.set(addr, { volume24h: vol, liquidityUsd: liq });
          }
        }
        setCache(cacheKey, batchMap);
        for (const [k, v] of batchMap) pairMap.set(k, v);
      }
    } catch {
      // DexScreener unavailable — continue without market data
    }
  }

  // Fetch scores from user_scans (latest per mint)
  const sb = getSupabase();
  const scoreMap = new Map<string, { score: number; risk_level: string }>();
  if (sb && mints.length > 0) {
    try {
      const mintList = mints.map((m) => `"${m}"`).join(",");
      const res = await fetch(
        `${sb.base}/user_scans?mint=in.(${mintList})&order=scanned_at.desc&limit=100`,
        { headers: sb.headers }
      );
      if (res.ok) {
        const rows = (await res.json()) as Array<{
          mint: string;
          score: number;
          risk_level: string;
        }>;
        for (const row of rows) {
          if (!scoreMap.has(row.mint)) {
            scoreMap.set(row.mint, { score: row.score, risk_level: row.risk_level });
          }
        }
      }
    } catch {}
  }

  // Merge
  for (const r of results) {
    const market = pairMap.get(r.mint);
    if (market) {
      r.volume24h = market.volume24h;
      r.liquidityUsd = market.liquidityUsd;
    }
    const sc = scoreMap.get(r.mint);
    if (sc) {
      r.score = sc.score;
      r.risk_level = sc.risk_level;
    }
    r.verified = (r.score ?? 0) >= 90;
  }

  return results;
}

// ── GET handler ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return json({ success: false, error: "RATE_LIMITED" }, 429);
  }

  const filter = (req.nextUrl.searchParams.get("filter") ?? "recent") as Filter;
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 20)));

  // Check full-page cache
  const pageCacheKey = `feed:${filter}:${limit}`;
  const cached = getCached(pageCacheKey);
  if (cached) {
    return json({ success: true, filter, launches: cached });
  }

  const sb = getSupabase();
  if (!sb) {
    return json({ success: true, filter, launches: [] });
  }

  try {
    // Fetch launches from Supabase (recent 100 to have enough for all filters)
    const res = await fetch(
      `${sb.base}/user_launches?order=created_at.desc&limit=100`,
      { headers: sb.headers }
    );
    if (!res.ok) {
      return json({ success: true, filter, launches: [] });
    }

    const rows = (await res.json()) as LaunchRow[];

    // Deduplicate by mint (keep most recent)
    const seen = new Set<string>();
    const unique: LaunchRow[] = [];
    for (const r of rows) {
      if (!seen.has(r.mint)) {
        seen.add(r.mint);
        unique.push(r);
      }
    }

    // Enrich with market data + scores
    const enriched = await enrichWithMarketData(unique);

    // Apply filter + sort
    let sorted: EnrichedLaunch[];
    switch (filter) {
      case "top":
        sorted = enriched.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
        break;
      case "verified":
        sorted = enriched.filter((l) => l.verified).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        break;
      case "volume_asc":
        sorted = enriched.sort((a, b) => (a.volume24h ?? 0) - (b.volume24h ?? 0));
        break;
      case "volume_desc":
        sorted = enriched.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
        break;
      default: // recent
        sorted = enriched; // already ordered by created_at DESC
    }

    const result = sorted.slice(0, limit);
    setCache(pageCacheKey, result);

    return json({ success: true, filter, launches: result });
  } catch (e) {
    console.error("[launchpad/feed]", e);
    return json({ success: true, filter, launches: [] });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}
