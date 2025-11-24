import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, noStore } from "../../lib/cors";
import { randomUUID } from "node:crypto";

const BAGS_API_BASE =
  process.env.BAGS_API_BASE || "https://public-api-v2.bags.fm/api/v1";
const BAGS_API_KEY = process.env.BAGS_API_KEY;

type CreateConfigBody = {
  launchWallet: string;
  tipWallet?: string;
  tipLamports?: number;
};

function newRequestId(): string {
  try {
    return randomUUID();
  } catch {
    return (
      Math.random().toString(16).slice(2) +
      "-" +
      Date.now().toString(16)
    );
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS + no-store padronizados
  setCors(res);
  noStore(res);

  const requestId = newRequestId();
  res.setHeader("X-Request-Id", requestId);

  // OPTIONS simples
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

  let body: CreateConfigBody;

  try {
    const raw = (req.body ?? {}) as any;
    const obj = typeof raw === "string" ? JSON.parse(raw || "{}") : raw;
    body = obj as CreateConfigBody;
  } catch (err) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body is not valid JSON.",
      },
      meta: { requestId },
    });
    return;
  }

  const launchWalletRaw =
    typeof body.launchWallet === "string" ? body.launchWallet.trim() : "";

  if (!launchWalletRaw || launchWalletRaw.length < 32) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_LAUNCH_WALLET",
        message:
          "Field 'launchWallet' is required and must be a valid wallet address.",
      },
      meta: { requestId },
    });
    return;
  }

  const payload: CreateConfigBody = {
    launchWallet: launchWalletRaw,
  };

  const tipWalletRaw =
    typeof body.tipWallet === "string" ? body.tipWallet.trim() : "";

  if (tipWalletRaw) {
    payload.tipWallet = tipWalletRaw;
  }

  const tipLamportsRaw = body.tipLamports;
  if (
    typeof tipLamportsRaw === "number" &&
    Number.isFinite(tipLamportsRaw) &&
    tipLamportsRaw > 0
  ) {
    payload.tipLamports = tipLamportsRaw;
  }

  const url =
    BAGS_API_BASE.replace(/\/+$/, "") + "/token-launch/create-config";

  const started = Date.now();

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": BAGS_API_KEY as string,
        Authorization: `Bearer ${BAGS_API_KEY as string}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    let json: any;

    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    const upstreamSuccess =
      upstream.ok &&
      json &&
      json.success !== false &&
      !json.error;

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
            message: "Bags create-config call failed.",
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
