import { BAGS_API_BASE, BAGS_TIMEOUT_MS } from "./constants";

export type BagsErrorCode =
  | "BAGS_NOT_CONFIGURED"
  | "UPSTREAM_REQUEST_FAILED"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_BAD_RESPONSE";

export interface BagsError {
  code: BagsErrorCode;
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

/**
 * Init simplificado para requests HTTP ao upstream Bags.
 */
type HttpRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

const _fetch: any = (globalThis as any).fetch;

/**
 * Função base para chamadas HTTP à Bags API.
 * Retorna sempre um BagsResult<TResponse>.
 */
async function bagsFetch<TResponse>(
  path: string,
  init: HttpRequestInit = {}
): Promise<BagsResult<TResponse>> {
  if (!BAGS_API_BASE) {
    return {
      success: false,
      error: {
        code: "BAGS_NOT_CONFIGURED",
        details: { path, reason: "MISSING_BASE_URL" },
      },
    };
  }

  const apiKey = (process.env.BAGS_API_KEY ?? "").trim();
  if (!apiKey) {
    return {
      success: false,
      error: {
        code: "BAGS_NOT_CONFIGURED",
        details: { path, reason: "MISSING_API_KEY" },
      },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BAGS_TIMEOUT_MS);

  try {
    const base = BAGS_API_BASE.replace(/\/+$/, "");
    const cleanPath = path.replace(/^\/+/, "");
    const url = `${base}/${cleanPath}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers ?? {}),
    };

    const requestInit: any = {
      method: init.method ?? "GET",
      headers,
      body: init.body,
      signal: controller.signal,
    };

    const res = await _fetch(url, requestInit);
    const text = await res.text();

    let json: any = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    if (!res.ok) {
      const code: BagsErrorCode =
        res.status === 429
          ? "UPSTREAM_RATE_LIMITED"
          : "UPSTREAM_REQUEST_FAILED";

      return {
        success: false,
        error: {
          code,
          details: {
            status: res.status,
            statusText: res.statusText,
            body: json ?? text,
          },
        },
      };
    }

    if (!json || typeof json !== "object") {
      return {
        success: false,
        error: {
          code: "UPSTREAM_BAD_RESPONSE",
          details: { body: text },
        },
      };
    }

    // Padrão esperado da Bags: { success:boolean, response|error:... }
    if (typeof json.success === "boolean") {
      return json as BagsResult<TResponse>;
    }

    return {
      success: false,
      error: {
        code: "UPSTREAM_BAD_RESPONSE",
        details: { body: json },
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "UPSTREAM_REQUEST_FAILED",
        details: {
          message: String(err),
          path,
        },
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Ping "local": verifica se a config da Bags está presente.
 * Não chama HTTP externo – é um health de configuração.
 */
export interface BagsPingResponse {
  upstream: "bags";
  ok: boolean;
  timestamp: string;
  config: {
    base: string | null;
    hasApiKey: boolean;
  };
}

export async function bagsPing(): Promise<BagsResult<BagsPingResponse>> {
  const base = BAGS_API_BASE ?? null;
  const apiKey = (process.env.BAGS_API_KEY ?? "").trim();
  const hasApiKey = apiKey.length > 0;

  if (!base || !hasApiKey) {
    return {
      success: false,
      error: {
        code: "BAGS_NOT_CONFIGURED",
        details: {
          base,
          hasApiKey,
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
        hasApiKey,
      },
    },
  };
}

/**
 * Criação de token info via Bags (token-launch/create-token-info).
 * Aqui usamos imageUrl/metadataUrl para simplificar (sem multipart ainda).
 */
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
  tokenMetadata: Record<string, unknown>;
  tokenLaunch: {
    status: "PRE_LAUNCH" | "PRE_GRAD" | "MIGRATING" | "MIGRATED";
    [key: string]: unknown;
  };
}

export async function createTokenInfo(
  payload: CreateTokenInfoRequest
): Promise<BagsResult<CreateTokenInfoResponse>> {
  return bagsFetch<CreateTokenInfoResponse>("/token-launch/create-token-info", {
    method: "POST",
    headers: {},
    body: JSON.stringify(payload),
  });
}

/**
 * Criação de config de lançamento (token-launch/create-config).
 */
export interface CreateLaunchConfigRequest {
  launchWallet: string;
  tipWallet?: string;
  tipLamports?: number;
}

export interface CreateLaunchConfigResponse {
  configKey: string;
  tx: string | null;
}

export async function createLaunchConfig(
  payload: CreateLaunchConfigRequest
): Promise<BagsResult<CreateLaunchConfigResponse>> {
  return bagsFetch<CreateLaunchConfigResponse>("/token-launch/create-config", {
    method: "POST",
    headers: {},
    body: JSON.stringify(payload),
  });
}

/**
 * Consulta de pool config keys a partir de feeClaimerVaults.
 */
export interface PoolConfigKeysRequest {
  feeClaimerVaults: string[];
}

export interface PoolConfigKeysResponse {
  poolConfigKeys: string[];
}

export async function getPoolConfigKeys(
  payload: PoolConfigKeysRequest
): Promise<BagsResult<PoolConfigKeysResponse>> {
  return bagsFetch<PoolConfigKeysResponse>("/token-launch/state/pool-config", {
    method: "POST",
    headers: {},
    body: JSON.stringify(payload),
  });
}
