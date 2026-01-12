import { getBagsBase as getBagsBaseFromEnv, getBagsApiKey, getBagsTimeoutMs } from "./env";

export const BAGS_DEFAULT_BASE = "https://public-api-v2.bags.fm/api/v1";

export type BagsErrorCode =
  | "BAGS_NOT_CONFIGURED"
  | "UPSTREAM_REQUEST_FAILED"
  | "UPSTREAM_BAD_RESPONSE"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_UNEXPECTED_ERROR";

export interface BagsError {
  code: BagsErrorCode | string;
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

export interface BagsPingResponse {
  upstream: "bags";
  ok: boolean;
  timestamp: string;
  config: {
    base: string;
    hasApiKey: boolean;
  };
}

export interface CreateTokenInfoRequest {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  metadataUrl?: string;
  telegram?: string;
  twitter?: string;
  website?: string;
}

export interface CreateTokenInfoResponse {
  tokenMint: string;
  tokenMetadata: unknown;
  tokenLaunch: unknown;
}

function getBagsBase(): string {
  const base = getBagsBaseFromEnv();
  return base ?? BAGS_DEFAULT_BASE;
}

function getApiKey(): string | null {
  return getBagsApiKey();
}

export async function pingBagsConfig(): Promise<BagsResult<BagsPingResponse>> {
  const base = getBagsBase();
  const apiKey = getApiKey();

  if (!base || !apiKey) {
    return {
      success: false,
      error: {
        code: "BAGS_NOT_CONFIGURED",
        details: {
          base,
          hasApiKey: Boolean(apiKey),
        },
      },
    };
  }

  return {
    success: true,
    response: {
      upstream: "bags",
      ok: true,
      timestamp: new Date().toISOString(),
      config: {
        base,
        hasApiKey: true,
      },
    },
  };
}

interface BagsFetchOptions {
  path: string;
  method?: string;
  body?: unknown;
}

async function bagsFetch<T>(opts: BagsFetchOptions): Promise<BagsResult<T>> {
  const base = getBagsBase();
  const apiKey = getApiKey();

  if (!base || !apiKey) {
    return {
      success: false,
      error: {
        code: "BAGS_NOT_CONFIGURED",
        details: {
          base,
          hasApiKey: Boolean(apiKey),
        },
      },
    };
  }

  const url = base + opts.path;
  const timeoutMs = getBagsTimeoutMs();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: any;

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-api-key": apiKey,
      Authorization: `Bearer ${apiKey}`,
    };

    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    return {
      success: false,
      error: {
        code: "UPSTREAM_REQUEST_FAILED",
        details: {
          message: err instanceof Error ? err.message : String(err),
          url,
        },
      },
    };
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  let json: any = null;

  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // deixa em texto mesmo
    }
  }

  if (!res.ok) {
    const code: BagsErrorCode =
      res.status === 429 ? "UPSTREAM_RATE_LIMITED" : "UPSTREAM_BAD_RESPONSE";

    return {
      success: false,
      error: {
        code,
        details: {
          status: res.status,
          statusText: res.statusText,
          url,
          body: json ?? text,
        },
      },
    };
  }

  if (json && typeof json === "object" && json.success === false && json.error) {
    return {
      success: false,
      error: {
        code: json.error.code ?? "UPSTREAM_BAD_RESPONSE",
        details: json.error,
      },
    };
  }

  return {
    success: true,
    response: (json ?? (text as any)) as T,
  };
}

export async function createTokenInfo(
  req: CreateTokenInfoRequest
): Promise<BagsResult<CreateTokenInfoResponse>> {
  const body: any = {
    name: req.name,
    symbol: req.symbol,
    description: req.description ?? "",
    imageUrl: req.imageUrl,
    metadataUrl: req.metadataUrl,
    telegram: req.telegram,
    twitter: req.twitter,
    website: req.website,
  };

  for (const key of Object.keys(body)) {
    if (body[key] === undefined) {
      delete body[key];
    }
  }

  return bagsFetch<CreateTokenInfoResponse>({
    path: "/token-launch/create-token-info",
    method: "POST",
    body,
  });
}
