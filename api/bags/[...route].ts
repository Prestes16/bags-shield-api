import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, preflight, noStore, ensureRequestId } from "../lib/cors.js";
import { validatePayloadSize } from "../lib/payload-validation.js";

const BAGS_BASE = process.env.BAGS_API_BASE_REAL || "https://public-api-v2.bags.fm/api/v1";
const TIMEOUT_MS = Number(process.env.BAGS_TIMEOUT_MS || 12_000);

function noStore(res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
}

function send(res: VercelResponse, status: number, body: any) {
  noStore(res);
  res.status(status).json(body);
}

async function fetchJson(url: string, apiKey: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const r = await fetch(url, {
      ...init,
      headers: {
        "accept": "application/json",
        "x-api-key": apiKey,
        "authorization": `Bearer ${apiKey}`,
        ...(init?.headers || {}),
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
      risk: t?.risk ?? t?.grade ?? t?.badge ?? t?.level ?? null,
      raw: t,
    }))
    .filter((x: any) => x.symbol || x.mint);

  return tokens.length ? tokens : [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extração robusta do route param
  const routeParam = req.query.route;
  const rawUrl = req.url || "";
  const rawQuery = JSON.stringify(req.query);

  // Normaliza routeParam para array de strings
  let segs: string[] = [];
  if (Array.isArray(routeParam)) {
    segs = routeParam.map(String).filter(Boolean);
  } else if (routeParam) {
    segs = [String(routeParam)].filter(Boolean);
  } else {
    // Fallback: tenta extrair do URL diretamente
    const urlPath = rawUrl.split("?")[0] || "";
    const match = urlPath.match(/\/api\/bags\/(.+)$/);
    if (match && match[1]) {
      segs = match[1].split("/").filter(Boolean);
    }
  }
  const path = segs.join("/");

  // Debug log (remover depois de confirmar)
  console.log("[bags catch-all]", {
    rawUrl,
    rawQuery,
    routeParam,
    segs,
    path,
    method: req.method,
  });

  // Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    const requestId = ensureRequestId(res);
    setCors(res, req);
    return preflight(res, ["POST", "GET"], ["Content-Type", "Authorization", "x-api-key"], req);
  }

  // Handle POST requests for specific routes
  if (req.method === "POST") {
    const requestId = ensureRequestId(res);
    setCors(res, req);
    
    if (!validatePayloadSize(req, res, requestId)) {
      return;
    }

    const apiKey = (process.env.BAGS_API_KEY || "").trim();
    if (!apiKey) {
      return send(res, 501, { 
        success: false, 
        error: "server_not_configured", 
        message: "BAGS_API_KEY not set. This endpoint requires upstream API key configuration.",
        meta: { requestId }
      });
    }

    // Parse body
    let body: any = {};
    try {
      if (typeof req.body === "string") {
        body = JSON.parse(req.body);
      } else if (req.body) {
        body = req.body;
      }
    } catch (e) {
      return send(res, 400, { 
        success: false, 
        error: "invalid json",
        meta: { requestId }
      });
    }

    // POST /api/bags/token-info
    if (path === "token-info") {
      try {
        const url = `${BAGS_BASE}/token-info`;
        const r = await fetchJson(url, apiKey, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        
        if (!r.ok) {
          return send(res, r.status >= 400 && r.status < 500 ? r.status : 502, {
            success: false,
            error: "token-info failed",
            detail: r.data,
          });
        }
        
        return send(res, 200, { success: true, response: r.data, meta: { requestId } });
      } catch (e: any) {
        console.error("[bags/token-info] Error:", e?.message || String(e));
        const isDev = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "development";
        return send(res, 500, {
          success: false,
          error: "token-info error",
          message: isDev ? (e?.message || String(e)) : "internal server error",
          meta: { requestId }
        });
      }
    }

    // POST /api/bags/create-config
    if (path === "create-config") {
      try {
        const url = `${BAGS_BASE}/create-config`;
        const r = await fetchJson(url, apiKey, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        
        if (!r.ok) {
          return send(res, r.status >= 400 && r.status < 500 ? r.status : 502, {
            success: false,
            error: "create-config failed",
            detail: r.data,
            meta: { requestId }
          });
        }
        
        return send(res, 200, { success: true, response: r.data, meta: { requestId } });
      } catch (e: any) {
        console.error("[bags/create-config] Error:", e?.message || String(e));
        const isDev = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "development";
        return send(res, 500, {
          success: false,
          error: "create-config error",
          message: isDev ? (e?.message || String(e)) : "internal server error",
          meta: { requestId }
        });
      }
    }

    // Other POST routes not allowed
    return send(res, 405, { success: false, error: "Method Not Allowed", route: path });
  }

  // Só GET por enquanto (a gente adiciona POSTs depois com segurança)
  if (req.method !== "GET") {
    return send(res, 405, { success: false, error: "Method Not Allowed" });
  }

  const apiKey = (process.env.BAGS_API_KEY || "").trim();
  if (!apiKey) {
    const requestId = ensureRequestId(res);
    return send(res, 501, { 
      success: false, 
      error: "server_not_configured",
      message: "BAGS_API_KEY not set. This endpoint requires upstream API key configuration.",
      meta: { requestId }
    });
  }

  // --- /api/bags/ping ---
  if (path === "ping" || path === "") {
    // apenas confirma config + reachability base
    // Se path vazio, pode ser /api/bags/ (raiz) ou problema de extração
    if (path === "" && rawUrl.includes("/api/bags/") && !rawUrl.endsWith("/api/bags") && !rawUrl.endsWith("/api/bags/")) {
      // Path vazio mas URL não termina em /api/bags → problema de extração, tenta fallback novamente
      const urlPath = rawUrl.split("?")[0] || "";
      const match = urlPath.match(/\/api\/bags\/(.+)$/);
      if (match && match[1]) {
        const fallbackSegs = match[1].split("/").filter(Boolean);
        const fallbackPath = fallbackSegs.join("/");
        console.log("[bags catch-all] Fallback extraction", { rawUrl, fallbackPath });
        // Reprocessa com fallbackPath ao invés de path vazio
        if (fallbackPath === "trending") {
          // Recursão não, processa direto:
          const candidates = [
            `${BAGS_BASE}/trending`,
            `${BAGS_BASE}/tokens/trending`,
            `${BAGS_BASE}/token/trending`,
          ];
          let lastErr: any = null;
          for (const url of candidates) {
            const r = await fetchJson(url, apiKey);
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
        // Se não for trending, retorna 501 com debug
        return send(res, 501, {
          success: false,
          error: "Not implemented in consolidated /api/bags router yet",
          route: fallbackPath,
          debug: { routeParam, rawUrl, segs, extractedPath: fallbackPath },
        });
      }
    }
    return send(res, 200, {
      success: true,
      response: {
        hasKey: true,
        base: BAGS_BASE,
        timeoutMs: TIMEOUT_MS,
        now: new Date().toISOString(),
      },
    });
  }

  // --- /api/bags/trending ---
  if (path === "trending") {
    const candidates = [
      `${BAGS_BASE}/trending`,
      `${BAGS_BASE}/tokens/trending`,
      `${BAGS_BASE}/token/trending`,
    ];

    let lastErr: any = null;

    for (const url of candidates) {
      const r = await fetchJson(url, apiKey);

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

  // Default: rota ainda não portada
  return send(res, 501, {
    success: false,
    error: "Not implemented in consolidated /api/bags router yet",
    route: path,
  });
}
