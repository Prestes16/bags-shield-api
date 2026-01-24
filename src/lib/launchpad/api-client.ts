/**
 * API Client for Launchpad endpoints
 * Centralized client for making API calls
 */

export interface ApiResponse<T> {
  success: boolean;
  response?: T;
  error?: {
    code: string;
    message: string;
  };
  issues?: Array<{
    path: string;
    message: string;
  }>;
  meta?: {
    requestId: string;
    upstream?: string;
    upstreamStatus?: number;
    elapsedMs?: number;
    mode?: string;
  };
}

/**
 * Make API call with error handling
 */
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: {
          code: data.error?.code || "HTTP_ERROR",
          message: data.error?.message || `HTTP ${response.status}`,
        },
        issues: data.issues,
        meta: data.meta,
      };
    }

    return data as ApiResponse<T>;
  } catch (error) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message:
          error instanceof Error ? error.message : "Network request failed",
      },
    };
  }
}

/**
 * Create token info
 */
export async function createTokenInfo(token: {
  name: string;
  symbol: string;
  decimals: number;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  twitterHandle?: string;
  telegramHandle?: string;
}): Promise<ApiResponse<{ tokenMint: string; tokenMetadata: unknown; tokenLaunch: unknown }>> {
  return apiCall("/api/launchpad/token-info", {
    method: "POST",
    body: JSON.stringify(token),
  });
}

/**
 * Create launch config
 */
export async function createLaunchConfig(config: {
  launchWallet: string;
  tipWallet?: string;
  tipLamports?: number;
  token: {
    name: string;
    symbol: string;
    decimals: number;
    description?: string;
    imageUrl?: string;
    websiteUrl?: string;
    twitterHandle?: string;
    telegramHandle?: string;
  };
}): Promise<ApiResponse<{ configKey: string; tx: string | null }>> {
  return apiCall("/api/launchpad/create-config", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

/**
 * Run preflight validation
 */
export async function runPreflight(config: {
  launchWallet: string;
  tipWallet?: string;
  tipLamports?: number;
  token: {
    name: string;
    symbol: string;
    decimals: number;
    description?: string;
    imageUrl?: string;
    websiteUrl?: string;
    twitterHandle?: string;
    telegramHandle?: string;
  };
}): Promise<
  ApiResponse<{
    isValid: boolean;
    issues: Array<{ path: string; message: string; severity: string }>;
    warnings: Array<{ path: string; message: string }>;
    validatedAt: string;
    requestId: string;
  }>
> {
  return apiCall("/api/launchpad/preflight", {
    method: "POST",
    body: JSON.stringify({ config }),
  });
}

/**
 * Generate manifest
 */
export async function generateManifest(manifest: {
  mint: string;
  shieldScore: number;
  grade: "A" | "B" | "C" | "D" | "E";
  isSafe: boolean;
  badges: Array<{
    key: string;
    title: string;
    severity: "low" | "medium" | "high" | "critical";
    impact: "negative" | "neutral" | "positive";
    tags: string[];
  }>;
  summary: string;
}): Promise<
  ApiResponse<{
    mint: string;
    shieldScore: number;
    grade: string;
    isSafe: boolean;
    badges: unknown[];
    summary: string;
    evaluatedAt: string;
    requestId: string;
    payloadHash: string;
    signature: string;
  }>
> {
  return apiCall("/api/launchpad/manifest", {
    method: "POST",
    body: JSON.stringify(manifest),
  });
}
