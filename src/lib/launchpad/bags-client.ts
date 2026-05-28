/**
 * Server-side Bags API client for Launchpad v2.
 *
 * Never import this from client components. It reads BAGS_API_KEY from env and
 * returns sanitized errors so upstream details do not leak secrets.
 */

import { getBagsBase, getBagsApiKey, getBagsTimeoutMs } from "@/lib/env";

export type BagsErrorCode =
  | "BAGS_NOT_CONFIGURED"
  | "UPSTREAM_REQUEST_FAILED"
  | "UPSTREAM_BAD_RESPONSE"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_UNEXPECTED_ERROR";

export interface BagsError {
  code: BagsErrorCode | string;
  message: string;
  details?: Record<string, unknown>;
}

export interface BagsSuccess<T> {
  success: true;
  response: T;
}

export interface BagsFailure {
  success: false;
  error: BagsError;
}

export type BagsResult<T> = BagsSuccess<T> | BagsFailure;

export interface BagsTokenInfoRequest {
  name: string;
  symbol: string;
  description: string;
  image?: File;
  imageUrl?: string;
  metadataUrl?: string;
  telegram?: string;
  twitter?: string;
  discord?: string;
  website?: string;
}

export interface BagsTokenInfoResponse {
  tokenMint: string;
  tokenMetadata?: string;
  tokenLaunch?: {
    tokenMint?: string;
    uri?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface BagsFeeShareConfigRequest {
  payer: string;
  baseMint: string;
  claimersArray: string[];
  basisPointsArray: number[];
  partner?: string;
  partnerConfig?: string;
  additionalLookupTables?: string[];
  bagsConfigType?: string;
  tipWallet?: string;
  tipLamports?: number;
}

export interface BagsFeeShareConfigResponse {
  needsCreation?: boolean;
  feeShareAuthority?: string;
  meteoraConfigKey?: string;
  configKey?: string;
  transactions?: Array<{
    blockhash?: { blockhash: string; lastValidBlockHeight: number };
    transaction: string;
  }>;
  bundles?: Array<
    Array<{
      blockhash?: { blockhash: string; lastValidBlockHeight: number };
      transaction: string;
    }>
  >;
  [key: string]: unknown;
}

export interface BagsCreateLaunchTransactionRequest {
  ipfs?: string;
  tokenMint: string;
  wallet: string;
  initialBuyLamports: number;
  configKey: string;
  tipWallet?: string;
  tipLamports?: number;
}

export type BagsCreateLaunchTransactionResponse = string;

// ── Fee-claim types ──────────────────────────────────────────────────────────

export interface BagsClaimablePosition {
  tokenMint: string;
  poolAddress: string;
  feeClaimer: string;
  claimableSol: number;
  claimableTokens: number;
}

export interface BagsClaimTransactionsV3Request {
  feeClaimer: string;
  tokenMint: string;
  wallet?: string;
}

export interface BagsClaimTransaction {
  tx: string;
  blockhash?: string;
  encoding?: "base58" | "base64";
  description?: string;
}

// ── GET helper ────────────────────────────────────────────────────────────────

async function bagsGetFetch<T>(
  path: string,
  params: Record<string, string>,
): Promise<BagsResult<T>> {
  const config = getConfig();
  if ("error" in config) return { success: false, error: config.error };

  const { base, apiKey, timeoutMs } = config.response;
  const qs = new URLSearchParams(params).toString();
  const url = `${base}${path}${qs ? `?${qs}` : ""}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    const data = await readJsonOrText(res);
    const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;

    if (!res.ok) {
      return {
        success: false,
        error: {
          code: res.status === 429 ? "UPSTREAM_RATE_LIMITED" : "UPSTREAM_BAD_RESPONSE",
          message: sanitizeUpstreamError(record?.error ?? record?.message ?? data),
          details: { status: res.status, statusText: res.statusText },
        },
      };
    }

    if (record?.success === false) {
      return {
        success: false,
        error: {
          code: "UPSTREAM_BAD_RESPONSE",
          message: sanitizeUpstreamError(record.error),
        },
      };
    }

    return {
      success: true,
      response: (record && "response" in record ? record.response : data) as T,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "UPSTREAM_REQUEST_FAILED",
        message:
          error instanceof Error && error.name === "AbortError"
            ? "Bags API request timed out"
            : "Bags API request failed",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}


function sanitizeUpstreamError(value: unknown): string {
  if (!value) return "Bags API request failed";
  if (typeof value === "string") return value.slice(0, 500);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const message = record.message ?? record.error ?? record.code;
    if (typeof message === "string") return message.slice(0, 500);
  }
  return "Bags API request failed";
}

function getConfig(): BagsResult<{ base: string; apiKey: string; timeoutMs: number }> {
  const base = getBagsBase();
  const apiKey = getBagsApiKey();
  const timeoutMs = getBagsTimeoutMs();

  if (!base || !apiKey) {
    return {
      success: false,
      error: {
        code: "BAGS_NOT_CONFIGURED",
        message: "Bags API is not configured on the server",
        details: { hasBase: Boolean(base), hasApiKey: Boolean(apiKey) },
      },
    };
  }

  return { success: true, response: { base, apiKey, timeoutMs } };
}

async function readJsonOrText(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function bagsJsonFetch<T>(path: string, body: unknown): Promise<BagsResult<T>> {
  const config = getConfig();
  if ("error" in config) return { success: false, error: config.error };

  const { base, apiKey, timeoutMs } = config.response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    const data = await readJsonOrText(res);
    const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;

    if (!res.ok) {
      return {
        success: false,
        error: {
          code: res.status === 429 ? "UPSTREAM_RATE_LIMITED" : "UPSTREAM_BAD_RESPONSE",
          message: sanitizeUpstreamError(record?.error ?? record?.message ?? data),
          details: { status: res.status, statusText: res.statusText },
        },
      };
    }

    if (record?.success === false) {
      return {
        success: false,
        error: {
          code: "UPSTREAM_BAD_RESPONSE",
          message: sanitizeUpstreamError(record.error),
        },
      };
    }

    return {
      success: true,
      response: (record && "response" in record ? record.response : data) as T,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "UPSTREAM_REQUEST_FAILED",
        message: error instanceof Error && error.name === "AbortError"
          ? "Bags API request timed out"
          : "Bags API request failed",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function bagsFormFetch<T>(path: string, formData: FormData): Promise<BagsResult<T>> {
  const config = getConfig();
  if ("error" in config) return { success: false, error: config.error };

  const { base, apiKey, timeoutMs } = config.response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
      },
      body: formData,
      signal: controller.signal,
      cache: "no-store",
    });

    const data = await readJsonOrText(res);
    const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;

    if (!res.ok) {
      return {
        success: false,
        error: {
          code: res.status === 429 ? "UPSTREAM_RATE_LIMITED" : "UPSTREAM_BAD_RESPONSE",
          message: sanitizeUpstreamError(record?.error ?? record?.message ?? data),
          details: { status: res.status, statusText: res.statusText },
        },
      };
    }

    if (record?.success === false) {
      return {
        success: false,
        error: {
          code: "UPSTREAM_BAD_RESPONSE",
          message: sanitizeUpstreamError(record.error),
        },
      };
    }

    return {
      success: true,
      response: (record && "response" in record ? record.response : data) as T,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "UPSTREAM_REQUEST_FAILED",
        message: error instanceof Error && error.name === "AbortError"
          ? "Bags API request timed out"
          : "Bags API request failed",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function appendIfPresent(formData: FormData, key: string, value: string | undefined) {
  if (value && value.trim()) formData.append(key, value.trim());
}

export async function createTokenInfo(
  req: BagsTokenInfoRequest,
): Promise<BagsResult<BagsTokenInfoResponse>> {
  const formData = new FormData();
  formData.append("name", req.name);
  formData.append("symbol", req.symbol);
  formData.append("description", req.description);
  if (req.image) formData.append("image", req.image, req.image.name || "token-image");
  appendIfPresent(formData, "imageUrl", req.imageUrl);
  appendIfPresent(formData, "metadataUrl", req.metadataUrl);
  appendIfPresent(formData, "telegram", req.telegram);
  appendIfPresent(formData, "twitter", req.twitter);
  appendIfPresent(formData, "discord", req.discord);
  appendIfPresent(formData, "website", req.website);

  return bagsFormFetch<BagsTokenInfoResponse>("/token-launch/create-token-info", formData);
}

export async function createFeeShareConfig(
  req: BagsFeeShareConfigRequest,
): Promise<BagsResult<BagsFeeShareConfigResponse>> {
  return bagsJsonFetch<BagsFeeShareConfigResponse>("/fee-share/config", req);
}

export async function createLaunchTransaction(
  req: BagsCreateLaunchTransactionRequest,
): Promise<BagsResult<BagsCreateLaunchTransactionResponse>> {
  return bagsJsonFetch<BagsCreateLaunchTransactionResponse>(
    "/token-launch/create-launch-transaction",
    req,
  );
}

export async function getClaimablePositions(
  wallet: string,
): Promise<BagsResult<BagsClaimablePosition[]>> {
  return bagsGetFetch<BagsClaimablePosition[]>("/token-launch/claimable-positions", { wallet });
}

export async function getClaimTransactionsV3(
  req: BagsClaimTransactionsV3Request,
): Promise<BagsResult<BagsClaimTransaction[]>> {
  return bagsJsonFetch<BagsClaimTransaction[]>("/token-launch/claim-txs/v3", req);
}
