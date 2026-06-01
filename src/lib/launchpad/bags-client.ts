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
  metadataUrl?: string;
  tokenMint: string;
  wallet: string;
  launchWallet?: string;
  initialBuyLamports: number;
  configKey: string;
  tipWallet?: string;
  tipLamports?: number;
}

export type BagsCreateLaunchTransactionResponse = string;

export type BagsPartnerConfigCreationTxResponse =
  | string
  | {
      transaction?: string;
      blockhash?: unknown;
      [key: string]: unknown;
    };

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
      const upstreamError = record?.error ?? record?.message ?? data;
      return {
        success: false,
        error: {
          code: res.status === 429 ? "UPSTREAM_RATE_LIMITED" : "UPSTREAM_BAD_RESPONSE",
          message: sanitizeUpstreamError(upstreamError),
          details: buildUpstreamErrorDetails(upstreamError, res.status, res.statusText),
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

function sanitizeUpstreamCode(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const code = record.code ?? record.errorCode ?? record.name;
  if (typeof code !== "string") return undefined;
  const compact = code.trim().slice(0, 120);
  return compact || undefined;
}

function sanitizeRawResponseHint(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  let raw: string;

  try {
    raw = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    raw = String(value);
  }

  const redacted = raw
    .replace(/("(?:signedTransaction|transaction|serializedTransaction|privateKey|apiKey|secret|authorization|x-api-key)"\s*:\s*")([^"]+)(")/gi, "$1[redacted]$3")
    .replace(/\b[A-Za-z0-9+/=]{96,}\b/g, "[redacted-long-value]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);

  return redacted || undefined;
}

function buildUpstreamErrorDetails(
  value: unknown,
  status: number,
  statusText: string,
): Record<string, unknown> {
  const upstreamCode = sanitizeUpstreamCode(value);
  const upstreamMessage = sanitizeUpstreamError(value);
  const rawResponseHint = sanitizeRawResponseHint(value);

  return {
    status,
    statusText,
    ...(upstreamCode ? { upstreamCode } : {}),
    ...(upstreamMessage ? { upstreamMessage } : {}),
    ...(rawResponseHint ? { rawResponseHint } : {}),
  };
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
      const upstreamError = record?.error ?? record?.message ?? data;
      return {
        success: false,
        error: {
          code: res.status === 429 ? "UPSTREAM_RATE_LIMITED" : "UPSTREAM_BAD_RESPONSE",
          message: sanitizeUpstreamError(upstreamError),
          details: buildUpstreamErrorDetails(upstreamError, res.status, res.statusText),
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
      const upstreamError = record?.error ?? record?.message ?? data;
      return {
        success: false,
        error: {
          code: res.status === 429 ? "UPSTREAM_RATE_LIMITED" : "UPSTREAM_BAD_RESPONSE",
          message: sanitizeUpstreamError(upstreamError),
          details: buildUpstreamErrorDetails(upstreamError, res.status, res.statusText),
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

export async function createPartnerConfigCreationTx(
  partnerWallet: string,
): Promise<BagsResult<BagsPartnerConfigCreationTxResponse>> {
  return bagsJsonFetch<BagsPartnerConfigCreationTxResponse>(
    "/fee-share/partner-config/creation-tx",
    { partnerWallet },
  );
}

type LaunchTransactionBodyShape = "api-reference" | "sdk-guide";

function buildCreateLaunchTransactionBody(
  req: BagsCreateLaunchTransactionRequest,
  shape: LaunchTransactionBodyShape,
): Record<string, unknown> {
  const metadataUri = req.ipfs || req.metadataUrl;
  const wallet = req.wallet || req.launchWallet;
  const common = {
    tokenMint: req.tokenMint,
    initialBuyLamports: req.initialBuyLamports,
    configKey: req.configKey,
    ...(req.tipWallet && req.tipLamports && req.tipLamports > 0
      ? { tipWallet: req.tipWallet, tipLamports: req.tipLamports }
      : {}),
  };

  return shape === "sdk-guide"
    ? { ...common, metadataUrl: metadataUri, launchWallet: wallet }
    : { ...common, ipfs: metadataUri, wallet };
}

function shouldRetryLaunchBodyShape(error: BagsError) {
  const status = typeof error.details?.status === "number" ? error.details.status : undefined;
  if (status !== 400 && status !== 422) return false;

  const message = String(error.details?.upstreamMessage || error.message || "");
  return /metadataUrl|launchWallet|ipfs|wallet|required|unknown|unexpected|validation|invalid body|bad request/i.test(message);
}

function launchAttemptSummary(shape: LaunchTransactionBodyShape, result: BagsResult<unknown>) {
  if (!("error" in result)) return { shape, success: true };
  return {
    shape,
    success: false,
    code: result.error.code,
    upstreamStatus: result.error.details?.status,
    upstreamCode: result.error.details?.upstreamCode,
    upstreamMessage: result.error.details?.upstreamMessage || result.error.message,
  };
}

export async function createLaunchTransaction(
  req: BagsCreateLaunchTransactionRequest,
): Promise<BagsResult<BagsCreateLaunchTransactionResponse>> {
  const primaryShape: LaunchTransactionBodyShape = "api-reference";
  const first = await bagsJsonFetch<BagsCreateLaunchTransactionResponse>(
    "/token-launch/create-launch-transaction",
    buildCreateLaunchTransactionBody(req, primaryShape),
  );
  if (!("error" in first) || !shouldRetryLaunchBodyShape(first.error)) return first;

  const fallbackShape: LaunchTransactionBodyShape = "sdk-guide";
  const second = await bagsJsonFetch<BagsCreateLaunchTransactionResponse>(
    "/token-launch/create-launch-transaction",
    buildCreateLaunchTransactionBody(req, fallbackShape),
  );
  if (!("error" in second)) return second;

  return {
    success: false,
    error: {
      ...second.error,
      details: {
        ...(second.error.details || {}),
        attempts: [
          launchAttemptSummary(primaryShape, first),
          launchAttemptSummary(fallbackShape, second),
        ],
      },
    },
  };
}

// ── Admin diagnostic ─────────────────────────────────────────────────────────

export interface PartnerConfigDiagnosticResult {
  variant: string;
  payloadKeys: string[];
  ok: boolean;
  status: number | undefined;
  upstreamCode: string | undefined;
  upstreamMessage: string | undefined;
  hasTransaction: boolean;
  transactionLength: number | null;
  blockhashPresent: boolean;
  rawResponseHint: string | undefined;
}

/** Extract the first transaction-like string from a response object. Never returned to callers. */
function pickTxFromRecord(record: Record<string, unknown> | null): string | null {
  if (!record) return null;
  for (const key of ["transaction", "tx", "serializedTransaction"]) {
    const v = record[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Admin-safe probe: calls POST /fee-share/partner-config/creation-tx with an
 * arbitrary body and returns only diagnostic metadata. Never exposes the API
 * key, never returns the transaction value, never signs or sends.
 */
export async function probePartnerConfigCreationTx(
  variant: string,
  body: Record<string, unknown>,
): Promise<PartnerConfigDiagnosticResult> {
  const config = getConfig();
  const payloadKeys = Object.keys(body);

  if ("error" in config) {
    return {
      variant,
      payloadKeys,
      ok: false,
      status: undefined,
      upstreamCode: "BAGS_NOT_CONFIGURED",
      upstreamMessage: config.error.message,
      hasTransaction: false,
      transactionLength: null,
      blockhashPresent: false,
      rawResponseHint: undefined,
    };
  }

  const { base, apiKey, timeoutMs } = config.response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${base}/fee-share/partner-config/creation-tx`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    const rawText = await res.text();
    let data: unknown = null;
    try { data = rawText ? JSON.parse(rawText) : null; } catch { data = rawText || null; }
    const record =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : null;
    const rawResponseHint = rawText ? rawText.slice(0, 300) : "(empty body)";

    // Transaction detection -- value is never returned to caller
    let tx: string | null = null;
    if (typeof data === "string" && data.trim()) {
      tx = data.trim();
    } else {
      tx = pickTxFromRecord(record);
    }

    // Error info from non-2xx responses
    const upstreamError = record?.error ?? record?.message ?? data;
    const upstreamCode = res.ok
      ? undefined
      : sanitizeUpstreamCode(upstreamError) ??
        (typeof record?.code === "string" ? record.code.slice(0, 120) : undefined);
    const upstreamMessage = res.ok ? undefined : sanitizeUpstreamError(upstreamError);

    // Blockhash detection
    const blockhashPresent =
      record != null && "blockhash" in record && record.blockhash != null;

    return {
      variant,
      payloadKeys,
      ok: res.ok,
      status: res.status,
      upstreamCode,
      upstreamMessage,
      hasTransaction: tx !== null,
      transactionLength: tx !== null ? tx.length : null,
      blockhashPresent,
      rawResponseHint: res.ok ? undefined : rawResponseHint,
    };
  } catch (err) {
    return {
      variant,
      payloadKeys,
      ok: false,
      status: undefined,
      upstreamCode: "REQUEST_FAILED",
      upstreamMessage:
        err instanceof Error && err.name === "AbortError"
          ? "Bags API request timed out"
          : "Bags API request failed",
      hasTransaction: false,
      transactionLength: null,
      blockhashPresent: false,
      rawResponseHint: undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
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
