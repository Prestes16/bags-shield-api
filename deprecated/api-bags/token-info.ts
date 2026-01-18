import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, noStore } from '.js';
import { randomUUID } from "node:crypto";

const BAGS_API_BASE =
  process.env.BAGS_API_BASE || "https://public-api-v2.bags.fm/api/v1";
const BAGS_API_KEY = process.env.BAGS_API_KEY;

type TokenInfoBody = {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  metadataUrl?: string;
  telegram?: string;
  twitter?: string;
  website?: string;
};

function newRequestId(): string {
  try {
    return randomUUID();
  } catch {
    return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
  }
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function cleanStr(v: unknown): string {
  if (typeof v !== "string") return "";
  // remove chars de controle e trim
  return v.replace(/[\u0000-\u001F\u007F]/g, "").trim();
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
        message: "Only POST is allowed on /api/bags/token-info.",
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

  // Hardening: recusar multipart nesse v1 (vamos suportar upload depois)
  const ct = cleanStr(req.headers["content-type"] || "");
  if (ct && !ct.toLowerCase().includes("application/json")) {
    res.status(415).json({
      success: false,
      error: {
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Use application/json for /api/bags/token-info (v1).",
      },
      meta: { requestId },
    });
    return;
  }

  // Hardening: limite simples por content-length (evita abuso)
  const cl = cleanStr(req.headers["content-length"] || "");
  const contentLength = cl ? Number(cl) : NaN;
  if (Number.isFinite(contentLength) && contentLength > 64_000) {
    res.status(413).json({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body too large.",
      },
      meta: { requestId },
    });
    return;
  }

  let body: TokenInfoBody;

  try {
    const raw = (req.body ?? {}) as any;
    const obj = typeof raw === "string" ? JSON.parse(raw || "{}") : raw;
    body = obj as TokenInfoBody;
  } catch {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_JSON", message: "Request body is not valid JSON." },
      meta: { requestId },
    });
    return;
  }

  // Validate fields (fail-closed)
  const name = cleanStr(body.name);
  const symbol = cleanStr(body.symbol).toUpperCase();
  const description = cleanStr(body.description);

  const imageUrl = cleanStr(body.imageUrl);
  const metadataUrl = cleanStr(body.metadataUrl);

  const telegram = cleanStr(body.telegram);
  const twitter = cleanStr(body.twitter);
  const website = cleanStr(body.website);

  if (!name || name.length > 32) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_NAME",
        message: "Field 'name' is required and must be <= 32 characters.",
      },
      meta: { requestId },
    });
    return;
  }

  if (!symbol || symbol.length > 10) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_SYMBOL",
        message: "Field 'symbol' is required and must be <= 10 characters.",
      },
      meta: { requestId },
    });
    return;
  }

  if (description && description.length > 1000) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_DESCRIPTION",
        message: "Field 'description' must be <= 1000 characters.",
      },
      meta: { requestId },
    });
    return;
  }

  // V1: exigir imageUrl OU metadataUrl (pra pular upload)
  if (!imageUrl && !metadataUrl) {
    res.status(400).json({
      success: false,
      error: {
        code: "MISSING_MEDIA",
        message: "Provide either 'imageUrl' or 'metadataUrl'.",
      },
      meta: { requestId },
    });
    return;
  }

  // Valida URLs (preferimos https)
  if (imageUrl && !isHttpsUrl(imageUrl)) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_IMAGE_URL",
        message: "Field 'imageUrl' must be a valid https URL.",
      },
      meta: { requestId },
    });
    return;
  }

  if (metadataUrl && !isHttpsUrl(metadataUrl)) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_METADATA_URL",
        message: "Field 'metadataUrl' must be a valid https URL.",
      },
      meta: { requestId },
    });
    return;
  }

  for (const [key, val] of [
    ["telegram", telegram],
    ["twitter", twitter],
    ["website", website],
  ] as const) {
    if (val && !isHttpUrl(val)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_URL",
          message: `Field '${key}' must be a valid http/https URL.`,
        },
        meta: { requestId },
      });
      return;
    }
    if (val && val.length > 200) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_URL_LENGTH",
          message: `Field '${key}' is too long.`,
        },
        meta: { requestId },
      });
      return;
    }
  }

  const url =
    BAGS_API_BASE.replace(/\/+$/, "") + "/token-launch/create-token-info";

  const started = Date.now();

  try {
    // Bags endpoint espera multipart/form-data; aqui usamos FormData mesmo com imageUrl
    const form = new FormData();
    form.append("name", name);
    form.append("symbol", symbol);
    if (description) form.append("description", description);

    if (imageUrl) form.append("imageUrl", imageUrl);
    if (metadataUrl) form.append("metadataUrl", metadataUrl);

    if (telegram) form.append("telegram", telegram);
    if (twitter) form.append("twitter", twitter);
    if (website) form.append("website", website);

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": BAGS_API_KEY as string,
        Authorization: `Bearer ${BAGS_API_KEY as string}`,
        // não setar content-type manualmente quando usa FormData
      },
      body: form as any,
    });

    const text = await upstream.text();
    let json: any;

    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    const upstreamSuccess =
      upstream.ok && json && json.success !== false && !json.error;

    const status = upstreamSuccess ? 200 : upstream.status || 502;

    res.status(status).json({
      success: upstreamSuccess,
      response: upstreamSuccess ? json.response ?? json : undefined,
      error: upstreamSuccess
        ? undefined
        : typeof json.error === "string"
        ? { code: "BAGS_ERROR", message: json.error }
        : json.error ?? {
            code: "BAGS_ERROR",
            message: "Bags token-info call failed.",
            details: json,
          },
      meta: {
        requestId,
        upstream: "bags",
        upstreamStatus: upstream.status,
        elapsedMs: Date.now() - started,
      },
    });
  } catch (err: any) {
    res.status(502).json({
      success: false,
      error: {
        code: "BAGS_FETCH_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
      meta: {
        requestId,
        upstream: "bags",
        elapsedMs: Date.now() - started,
      },
    });
  }
}
