import type { VercelRequest, VercelResponse } from "@vercel/node";

const BAGS_BASE = process.env.BAGS_API_BASE_REAL || "https://public-api-v2.bags.fm/api/v1";
const TIMEOUT_MS = Number(process.env.BAGS_TIMEOUT_MS || 12_000);

function noStore(res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
}

function send(res: VercelResponse, status: number, body: any) {
  noStore(res);
  res.status(status).json(body);
}

async function fetchJson(url: string, apiKey: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const r = await fetch(url, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "x-api-key": apiKey,
        "authorization": `Bearer ${apiKey}`,
      },
      signal: ctrl.signal,
    });

    const text = await r.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

    return { ok: r.ok, status: r.status, data };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Normaliza vários shapes possíveis da Bags API para:
 * { tokens: Array<{ symbol,name,mint,change24h,risk }> }
 * Não inventa nada: só mapeia o que vier.
 */
function normalizeTokens(payload: any) {
  const root = payload?.response ?? payload?.result ?? payload;
  const arr =
    root?.tokens ??
    root?.trending ??
    root?.items ??
    root?.data ??
    (Array.isArray(root) ? root : null);

  if (!Array.isArray(arr)) return null;

  const tokens = arr
    .map((t: any) => ({
      symbol: t?.symbol ?? t?.ticker ?? t?.name ?? null,
      name: t?.name ?? t?.symbol ?? null,
      mint: t?.mint ?? t?.address ?? t?.tokenMint ?? null,
      change24h: t?.change24h ?? t?.change_24h ?? t?.pct24h ?? t?.pct_change_24h ?? null,
      // risk pode vir como grade/badge/level
      risk: t?.risk ?? t?.grade ?? t?.badge ?? t?.level ?? null,
      raw: t,
    }))
    .filter((x: any) => x.symbol || x.mint);

  return tokens.length ? tokens : [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return send(res, 405, { success: false, error: "Method Not Allowed" });
  }

  const apiKey = (process.env.BAGS_API_KEY || "").trim();
  if (!apiKey) {
    return send(res, 500, { success: false, error: "Missing BAGS_API_KEY" });
  }

  // Tentamos endpoints possíveis (compat):
  const candidates = [
    `${BAGS_BASE}/trending`,
    `${BAGS_BASE}/tokens/trending`,
    `${BAGS_BASE}/token/trending`,
  ];

  let lastErr: any = null;

  for (const url of candidates) {
    const r = await fetchJson(url, apiKey);

    // se endpoint não existir, tenta o próximo
    if (r.status === 404 || r.status === 405) {
      lastErr = { url, status: r.status, data: r.data };
      continue;
    }

    if (!r.ok) {
      lastErr = { url, status: r.status, data: r.data };
      break;
    }

    const tokens = normalizeTokens(r.data);
    if (!tokens) {
      lastErr = { url, status: r.status, data: r.data, reason: "Unexpected shape" };
      break;
    }

    return send(res, 200, { success: true, response: { tokens } });
  }

  return send(res, 502, {
    success: false,
    error: "Bags trending endpoint unavailable",
    detail: lastErr,
  });
}
