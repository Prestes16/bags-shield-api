import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { setCors, noStore } from '.js';

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
  if (t.length < 32 || t.length > 44) return false;
  return isBase58(t);
}

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

  if (req.method !== "GET") {
    res.status(405).json({
      success: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Only GET is allowed on /api/bags/claimable-positions.",
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

  const wallet = cleanStr((req.query.wallet as string) || "");
  if (!isSolanaPubkey(wallet)) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_WALLET",
        message: "Query param 'wallet' must be a valid Solana public key.",
      },
      meta: { requestId },
    });
    return;
  }

  const url =
    BAGS_API_BASE.replace(/\/+$/, "") +
    "/token-launch/claimable-positions?wallet=" +
    encodeURIComponent(wallet);

  const started = Date.now();
  const ac = new AbortController();
  const timeoutMs = 10_000;
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const upstream = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": BAGS_API_KEY as string,
        Authorization: `Bearer ${BAGS_API_KEY as string}`,
      },
      signal: ac.signal,
    });

    const text = await upstream.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    const upstreamSuccess =
      upstream.ok && json && json.success !== false && !json.error;

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
            message: "Bags claimable-positions call failed.",
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
      meta: {
        requestId,
        upstream: "bags",
        elapsedMs: Date.now() - started,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}
