import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseRest,
  mapDbLaunchToFeedItem,
  type LaunchFeedItem,
  type UserLaunchRow,
} from "@/lib/launchpad/launch-registry";

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

type Filter = "recent" | "top" | "verified" | "volume_asc" | "volume_desc";

interface DexPair {
  chainId: string;
  baseToken?: { address?: string };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  info?: { imageUrl?: string };
}

interface EnrichedLaunch extends LaunchFeedItem {
  score: number | null;
  risk_level: string | null;
  volume24h: number | null;
  liquidityUsd: number | null;
  verified: boolean;
}

// ── DexScreener batch enrichment ─────────────────────────────────────────

async function enrichWithMarketData(
  launches: LaunchFeedItem[]
): Promise<EnrichedLaunch[]> {
  const results: EnrichedLaunch[] = launches.map((l) => ({
    ...l,
    score: null,
    risk_level: null,
    volume24h: null,
    liquidityUsd: null,
    verified: false,
    launchSource: "bags-shield" as const,
  }));

  // Track DexScreener images keyed by mint address
  const dexImageMap = new Map<string, string>();

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
          // Capture image from DexScreener if available
          const img = pair.info?.imageUrl;
          if (img && !dexImageMap.has(addr)) {
            dexImageMap.set(addr, img);
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
  const sb = getSupabaseRest();
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
    // Use stored image_url; fall back to DexScreener image if none
    if (!r.image_url) {
      r.image_url = dexImageMap.get(r.mint) ?? null;
    }
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

  const sb = getSupabaseRest();
  if (!sb) {
    return json({ success: true, filter, launches: [] });
  }

  try {
    // Fetch only rows with provenance columns. If the migration has not been
    // applied yet, PostgREST returns an error and the feed stays fail-closed.
    const selectFields = [
      "mint",
      "name",
      "symbol",
      "image_url",
      "created_at",
      "creator_wallet",
      "launch_wallet",
      "tx_signature",
      "launch_status",
      "origin",
      "app_created",
      "is_demo",
      "is_imported",
      "confirmed_at",
      "metadata_uri",
      "config_key",
    ].join(",");
    const res = await fetch(
      `${sb.base}/user_launches?select=${selectFields}&order=created_at.desc&limit=100`,
      { headers: sb.headers }
    );
    if (!res.ok) {
      console.warn("[launchpad/feed] provenance columns unavailable; returning empty feed");
      return json({ success: true, filter, launches: [] });
    }

    const rows = (await res.json()) as UserLaunchRow[];
    const realLaunches = rows
      .map(mapDbLaunchToFeedItem)
      .filter((row): row is LaunchFeedItem => Boolean(row));

    // Deduplicate by mint (keep most recent)
    const seen = new Set<string>();
    const unique: LaunchFeedItem[] = [];
    for (const r of realLaunches) {
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
