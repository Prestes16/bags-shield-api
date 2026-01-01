import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { setCors, noStore } from "../../lib/cors";

const BAGS_API_BASE =
  process.env.BAGS_API_BASE || "https://public-api-v2.bags.fm/api/v1";
const BAGS_API_KEY = process.env.BAGS_API_KEY;

type ClaimTxsV2Body = {
  feeClaimer?: string; // required
  tokenMint?: string; // required

  // optional (required depending on flags / position type)
  virtualPoolAddress?: string | null;

  dammV2Position?: string | null;
  dammV2Pool?: string | null;
  dammV2PositionNftAccount?: string | null;

  tokenAMint?: string | null;
  tokenBMint?: string | null;
  tokenAVault?: string | null;
  tokenBVault?: string | null;

  claimVirtualPoolFees?: boolean | null;
  claimDammV2Fees?: boolean | null;

  isCustomFeeVault?: boolean | null;
  feeShareProgramId?: string | null;
  customFeeVaultClaimerA?: string | null;
  customFeeVaultClaimerB?: string | null;
  customFeeVaultClaimerSide?: "A" | "B" | null;
};

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

function readPubkeyOptional(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = cleanStr(v);
  if (!s) return null;
  return isSolanaPubkey(s) ? s : "__INVALID__";
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
        message: "Only POST is allowed on /api/bags/claim-txs.",
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

  // JSON only
  const ct = cleanStr(req.headers["content-type"] || "").toLowerCase();
  if (ct && !ct.includes("application/json")) {
    res.status(415).json({
      success: false,
      error: {
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Use application/json for /api/bags/claim-txs.",
      },
      meta: { requestId },
    });
    return;
  }

  // cheap size guard (this endpoint should still be small-ish)
  const cl = cleanStr(req.headers["content-length"] || "");
  const contentLength = cl ? Number(cl) : NaN;
  if (Number.isFinite(contentLength) && contentLength > 64_000) {
    res.status(413).json({
      success: false,
      error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large." },
      meta: { requestId },
    });
    return;
  }

  let body: ClaimTxsV2Body;
  try {
    body = parseJsonBody(req) as ClaimTxsV2Body;
  } catch {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_JSON", message: "Request body is not valid JSON." },
      meta: { requestId },
    });
    return;
  }

  const feeClaimer = cleanStr(body.feeClaimer);
  if (!isSolanaPubkey(feeClaimer)) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_FEE_CLAIMER",
        message: "Field 'feeClaimer' must be a valid Solana public key.",
      },
      meta: { requestId },
    });
    return;
  }

  const tokenMint = cleanStr(body.tokenMint);
  if (!isSolanaPubkey(tokenMint)) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_TOKEN_MINT",
        message: "Field 'tokenMint' must be a valid Solana public key.",
      },
      meta: { requestId },
    });
    return;
  }

  const claimVirtualPoolFees = body.claimVirtualPoolFees === true;
  const claimDammV2Fees = body.claimDammV2Fees === true;
  const isCustomFeeVault = body.isCustomFeeVault === true;


  // Strict boolean flags (fail-closed)
  for (const key of ["claimVirtualPoolFees", "claimDammV2Fees", "isCustomFeeVault"] as const) {
    const v = (body as any)[key];
    if (v !== undefined && v !== null && typeof v !== "boolean") {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_FLAG_TYPE",
          message: `Field '${key}' must be boolean.`,
        },
        meta: { requestId },
      });
      return;
    }
  }

  if (!claimVirtualPoolFees && !claimDammV2Fees && !isCustomFeeVault) {
    res.status(400).json({
      success: false,
      error: {
        code: "MISSING_CLAIM_MODE",
        message:
          "Set at least one of 'claimVirtualPoolFees', 'claimDammV2Fees', or 'isCustomFeeVault' to true.",
      },
      meta: { requestId },
    });
    return;
  }
  const virtualPoolAddress = readPubkeyOptional(body.virtualPoolAddress);
  if (virtualPoolAddress === "__INVALID__") {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_VIRTUAL_POOL_ADDRESS",
        message: "Field 'virtualPoolAddress' must be a valid Solana public key.",
      },
      meta: { requestId },
    });
    return;
  }
  if (claimVirtualPoolFees && !virtualPoolAddress) {
    res.status(400).json({
      success: false,
      error: {
        code: "MISSING_VIRTUAL_POOL_ADDRESS",
        message:
          "Field 'virtualPoolAddress' is required when 'claimVirtualPoolFees' is true.",
      },
      meta: { requestId },
    });
    return;
  }

  const dammV2Position = readPubkeyOptional(body.dammV2Position);
  const dammV2Pool = readPubkeyOptional(body.dammV2Pool);
  const dammV2PositionNftAccount = readPubkeyOptional(body.dammV2PositionNftAccount);

  for (const [code, v] of [
    ["INVALID_DAMM_V2_POSITION", dammV2Position],
    ["INVALID_DAMM_V2_POOL", dammV2Pool],
    ["INVALID_DAMM_V2_POSITION_NFT_ACCOUNT", dammV2PositionNftAccount],
  ] as const) {
    if (v === "__INVALID__") {
      res.status(400).json({
        success: false,
        error: { code, message: "One or more DAMM v2 fields are invalid pubkeys." },
        meta: { requestId },
      });
      return;
    }
  }

  if (claimDammV2Fees && (!dammV2Position || !dammV2Pool || !dammV2PositionNftAccount)) {
    res.status(400).json({
      success: false,
      error: {
        code: "MISSING_DAMM_V2_FIELDS",
        message:
          "When 'claimDammV2Fees' is true, provide 'dammV2Position', 'dammV2Pool' and 'dammV2PositionNftAccount'.",
      },
      meta: { requestId },
    });
    return;
  }

  const tokenAMint = readPubkeyOptional(body.tokenAMint);
  const tokenBMint = readPubkeyOptional(body.tokenBMint);
  const tokenAVault = readPubkeyOptional(body.tokenAVault);
  const tokenBVault = readPubkeyOptional(body.tokenBVault);

  for (const [code, v] of [
    ["INVALID_TOKEN_A_MINT", tokenAMint],
    ["INVALID_TOKEN_B_MINT", tokenBMint],
    ["INVALID_TOKEN_A_VAULT", tokenAVault],
    ["INVALID_TOKEN_B_VAULT", tokenBVault],
  ] as const) {
    if (v === "__INVALID__") {
      res.status(400).json({
        success: false,
        error: { code, message: "One or more token/vault fields are invalid pubkeys." },
        meta: { requestId },
      });
      return;
    }
  }

  const feeShareProgramId = readPubkeyOptional(body.feeShareProgramId);
  if (feeShareProgramId === "__INVALID__") {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_FEE_SHARE_PROGRAM_ID",
        message: "Field 'feeShareProgramId' must be a valid Solana public key.",
      },
      meta: { requestId },
    });
    return;
  }
  if (isCustomFeeVault && !feeShareProgramId) {
    res.status(400).json({
      success: false,
      error: {
        code: "MISSING_FEE_SHARE_PROGRAM_ID",
        message:
          "Field 'feeShareProgramId' is required when 'isCustomFeeVault' is true.",
      },
      meta: { requestId },
    });
    return;
  }

  const customFeeVaultClaimerA = readPubkeyOptional(body.customFeeVaultClaimerA);
  const customFeeVaultClaimerB = readPubkeyOptional(body.customFeeVaultClaimerB);

  for (const [code, v] of [
    ["INVALID_CUSTOM_CLAIMER_A", customFeeVaultClaimerA],
    ["INVALID_CUSTOM_CLAIMER_B", customFeeVaultClaimerB],
  ] as const) {
    if (v === "__INVALID__") {
      res.status(400).json({
        success: false,
        error: { code, message: "Custom fee vault claimer is an invalid pubkey." },
        meta: { requestId },
      });
      return;
    }
  }

  const sideRaw = body.customFeeVaultClaimerSide;
  const customFeeVaultClaimerSide =
    sideRaw === "A" || sideRaw === "B" ? sideRaw : sideRaw == null ? null : "__INVALID__";

  if (customFeeVaultClaimerSide === "__INVALID__") {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_CUSTOM_CLAIMER_SIDE",
        message: "Field 'customFeeVaultClaimerSide' must be 'A' or 'B'.",
      },
      meta: { requestId },
    });
    return;
  }

  if (customFeeVaultClaimerSide && (!customFeeVaultClaimerA || !customFeeVaultClaimerB)) {
    res.status(400).json({
      success: false,
      error: {
        code: "MISSING_CUSTOM_CLAIMERS",
        message:
          "When 'customFeeVaultClaimerSide' is provided, also provide both 'customFeeVaultClaimerA' and 'customFeeVaultClaimerB'.",
      },
      meta: { requestId },
    });
    return;
  }

  // Build payload (only include defined/non-null optionals)
  const payload: any = {
    feeClaimer,
    tokenMint,
  };

  if (virtualPoolAddress) payload.virtualPoolAddress = virtualPoolAddress;
  if (dammV2Position) payload.dammV2Position = dammV2Position;
  if (dammV2Pool) payload.dammV2Pool = dammV2Pool;
  if (dammV2PositionNftAccount) payload.dammV2PositionNftAccount = dammV2PositionNftAccount;

  if (tokenAMint) payload.tokenAMint = tokenAMint;
  if (tokenBMint) payload.tokenBMint = tokenBMint;
  if (tokenAVault) payload.tokenAVault = tokenAVault;
  if (tokenBVault) payload.tokenBVault = tokenBVault;

  if (typeof body.claimVirtualPoolFees === "boolean")
    payload.claimVirtualPoolFees = body.claimVirtualPoolFees;
  if (typeof body.claimDammV2Fees === "boolean")
    payload.claimDammV2Fees = body.claimDammV2Fees;

  if (typeof body.isCustomFeeVault === "boolean")
    payload.isCustomFeeVault = body.isCustomFeeVault;

  if (feeShareProgramId) payload.feeShareProgramId = feeShareProgramId;
  if (customFeeVaultClaimerA) payload.customFeeVaultClaimerA = customFeeVaultClaimerA;
  if (customFeeVaultClaimerB) payload.customFeeVaultClaimerB = customFeeVaultClaimerB;
  if (customFeeVaultClaimerSide) payload.customFeeVaultClaimerSide = customFeeVaultClaimerSide;

  const url =
    BAGS_API_BASE.replace(/\/+$/, "") + "/token-launch/claim-txs/v2";

  const started = Date.now();
  const ac = new AbortController();
  const timeoutMs = 20_000;
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
            message: "Bags claim-txs call failed.",
            details: json,
          };

    res.status(status).json({
      success: upstreamSuccess,
      response: upstreamSuccess ? json.response ?? json : undefined,
      error,
      meta: {
        requestId,
        upstream: "bags",
        upstreamEndpoint: "/token-launch/claim-txs/v2",
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
        upstreamEndpoint: "/token-launch/claim-txs/v2",
        elapsedMs: Date.now() - started,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}
