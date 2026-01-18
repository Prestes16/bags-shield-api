import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, noStore } from '.js';
import { randomUUID } from "node:crypto";

const BAGS_API_BASE =
  process.env.BAGS_API_BASE || "https://public-api-v2.bags.fm/api/v1";
const BAGS_API_KEY = process.env.BAGS_API_KEY;

type CreateConfigBody = {
  launchWallet: string;
  tipWallet?: string;
  tipLamports?: number;
};

const DISALLOWED_LAUNCH_WALLETS = new Set<string>([
  // wSOL mint (valid pubkey format, but not a wallet for Bags create-config)
  "So11111111111111111111111111111111111111112",
]);

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

function parseJsonBody(req: VercelRequest): any {
  const raw = (req.body ?? {}) as any;
  if (typeof raw === "string") return JSON.parse(raw || "{}");
  return raw;
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

  if (req.method !== "POST") {
    res.status(405).json({
      success: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Only POST is allowed on /api/bags/create-config.",
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

  // Hardening: accept JSON only
  const ct = cleanStr(req.headers["content-type"] || "").toLowerCase();
  if (ct && !ct.includes("application/json")) {
    res.status(415).json({
      success: false,
      error: {
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Use application/json for /api/bags/create-config.",
      },
      meta: { requestId },
    });
    return;
  }

  // Hardening: cheap size guard (this endpoint should be tiny)
  const cl = cleanStr(req.headers["content-length"] || "");
  const contentLength = cl ? Number(cl) : NaN;
  if (Number.isFinite(contentLength) && contentLength > 16_000) {
    res.status(413).json({
      success: false,
      error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large." },
      meta: { requestId },
    });
    return;
  }

  let body: CreateConfigBody;
  try {
    body = parseJsonBody(req) as CreateConfigBody;
  } catch {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_JSON", message: "Request body is not valid JSON." },
      meta: { requestId },
    });
    return;
  }

  const launchWallet = cleanStr(body.launchWallet);

  if (!isSolanaPubkey(launchWallet)) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_LAUNCH_WALLET",
        message: "Field 'launchWallet' must be a valid Solana public key.",
      },
      meta: { requestId },
    });
    return;
  }

  if (DISALLOWED_LAUNCH_WALLETS.has(launchWallet)) {
    res.status(400).json({
      success: false,
      error: {
        code: "DISALLOWED_LAUNCH_WALLET",
        message:
          "This 'launchWallet' value is not allowed (looks like a token mint, not a wallet).",
      },
      meta: { requestId },
    });
    return;
  }

  const tipWallet = cleanStr(body.tipWallet);
  const tipLamports = body.tipLamports;

  if (tipWallet && !isSolanaPubkey(tipWallet)) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_TIP_WALLET",
        message: "Field 'tipWallet' must be a valid Solana public key.",
      },
      meta: { requestId },
    });
    return;
  }

  if (tipLamports !== undefined) {
    if (
      typeof tipLamports !== "number" ||
      !Number.isFinite(tipLamports) ||
      tipLamports < 0 ||
      !Number.isSafeInteger(tipLamports)
    ) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_TIP_LAMPORTS",
          message:
            "Field 'tipLamports' must be a non-negative safe integer (lamports).",
        },
        meta: { requestId },
      });
      return;
    }

    if (tipLamports > 0 && !tipWallet) {
      res.status(400).json({
        success: false,
        error: {
          code: "TIP_WALLET_REQUIRED",
          message: "If 'tipLamports' > 0, you must also provide 'tipWallet'.",
        },
        meta: { requestId },
      });
      return;
    }
  }

  const payload: CreateConfigBody = { launchWallet };
  if (tipWallet) payload.tipWallet = tipWallet;
  if (tipWallet && typeof tipLamports === "number" && tipLamports > 0) {
    payload.tipLamports = tipLamports;
  }

  const url =
    BAGS_API_BASE.replace(/\/+$/, "") + "/token-launch/create-config";

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
      body: JSON.stringify(payload),
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
    const status = upstreamSuccess
      ? 200
      : isUpstream5xx
      ? 502
      : upstream.status || 502;

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
            message: "Bags create-config call failed.",
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
