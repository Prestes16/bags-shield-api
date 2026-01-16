import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, noStore } from '.js';
import { randomUUID } from "node:crypto";

const BAGS_API_BASE =
  process.env.BAGS_API_BASE || "https://public-api-v2.bags.fm/api/v1";
const BAGS_API_KEY = process.env.BAGS_API_KEY;

function newRequestId(): string {
  try {
    return randomUUID();
  } catch {
    return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
  }
}

function cleanStr(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001F\u007F]/g, "").trim();
}

function isBase58(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
}

function isSolanaPubkey(s: string): boolean {
  const t = cleanStr(s);
  return t.length >= 32 && t.length <= 44 && isBase58(t);
}

function parseJsonBody(req: VercelRequest): any {
  const raw = (req.body ?? {}) as any;
  if (typeof raw === "string") return JSON.parse(raw || "{}");
  return raw;
}

type PoolConfigBody = {
  feeClaimerVaults: string[];
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  noStore(res);

  const requestId = newRequestId();
  res.setHeader("X-Request-Id", requestId);

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({
      success: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Only POST is allowed on /api/bags/pool-config.",
      },
      meta: { requestId },
    });
    return;
  }

  if (!BAGS_API_BASE || !BAGS_API_KEY) {
    res.status(500).json({
      success: false,
      error: {
        code: "BAGS_NOT_CONFIGURED",
        message:
          "BAGS_API_BASE or BAGS_API_KEY is not configured in the environment.",
      },
      meta: { requestId },
    });
    return;
  }

  // Hardening: JSON only
  const ct = cleanStr(req.headers["content-type"] || "").toLowerCase();
  if (ct && !ct.includes("application/json")) {
    res.status(415).json({
      success: false,
      error: {
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Use application/json for /api/bags/pool-config.",
      },
      meta: { requestId },
    });
    return;
  }

  // Hardening: cheap size guard (arrays can grow, but keep it sane)
  const cl = cleanStr(req.headers["content-length"] || "");
  const contentLength = cl ? Number(cl) : NaN;
  if (Number.isFinite(contentLength) && contentLength > 32_000) {
    res.status(413).json({
      success: false,
      error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large." },
      meta: { requestId },
    });
    return;
  }

  let body: PoolConfigBody;
  try {
    body = parseJsonBody(req) as PoolConfigBody;
  } catch {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_JSON", message: "Request body is not valid JSON." },
      meta: { requestId },
    });
    return;
  }

  const arr = Array.isArray(body?.feeClaimerVaults) ? body.feeClaimerVaults : [];

  if (!arr.length) {
    res.status(400).json({
      success: false,
      error: {
        code: "MISSING_FEE_CLAIMER_VAULTS",
        message: "Field 'feeClaimerVaults' must be a non-empty array.",
      },
      meta: { requestId },
    });
    return;
  }

  if (arr.length > 100) {
    res.status(400).json({
      success: false,
      error: {
        code: "TOO_MANY_VAULTS",
        message: "Too many items in 'feeClaimerVaults' (max 100).",
      },
      meta: { requestId },
    });
    return;
  }

  const cleaned: string[] = [];
  const seen = new Set<string>();

  for (const v of arr) {
    const s = cleanStr(v);
    if (!isSolanaPubkey(s)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_VAULT",
          message:
            "All items in 'feeClaimerVaults' must be valid Solana public keys.",
        },
        meta: { requestId },
      });
      return;
    }
    if (!seen.has(s)) {
      seen.add(s);
      cleaned.push(s);
    }
  }

  const url =
    BAGS_API_BASE.replace(/\/+$/, "") + "/token-launch/state/pool-config";

  const started = Date.now();

  const ac = new AbortController();
  const timeoutMs = 10_000;
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": BAGS_API_KEY as string,
        Authorization: `Bearer ${BAGS_API_KEY as string}`,
      },
      body: JSON.stringify({ feeClaimerVaults: cleaned }),
      signal: ac.signal,
    });

    const text = await upstream.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    const upstreamSuccess = upstream.ok && json && json.success !== false && !json.error;

    const isUpstream5xx = upstream.status >= 500;
    const status = upstreamSuccess ? 200 : isUpstream5xx ? 502 : upstream.status || 502;

    const error =
      upstreamSuccess
        ? undefined
        : isUpstream5xx
        ? {
            code: "UPSTREAM_ERROR",
            message: "Upstream Bags service returned an error.",
            details: { upstreamStatus: upstream.status, body: json },
          }
        : typeof json?.error === "string"
        ? { code: "BAGS_ERROR", message: json.error }
        : typeof json?.response === "string"
        ? { code: "BAGS_ERROR", message: json.response }
        : json?.error ?? {
            code: "BAGS_ERROR",
            message: "Bags pool-config call failed.",
            details: json,
          };

    res.status(status).json({
      success: upstreamSuccess,
      response: upstreamSuccess ? json.response ?? json : undefined,
      error,
      meta: {
        requestId,
        upstream: "bags",
        upstreamStatus: upstream.status,
        elapsedMs: Date.now() - started,
      },
    });
  } catch (err: any) {
    const msg =
      err?.name === "AbortError"
        ? `Upstream timeout after ${timeoutMs}ms`
        : err instanceof Error
        ? err.message
        : String(err);

    res.status(502).json({
      success: false,
      error: { code: "BAGS_FETCH_ERROR", message: msg },
      meta: { requestId, upstream: "bags", elapsedMs: Date.now() - started },
    });
  } finally {
    clearTimeout(timer);
  }
}
