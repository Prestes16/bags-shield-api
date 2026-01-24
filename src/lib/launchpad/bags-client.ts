/**
 * Bags API client helpers for Launchpad
 */

import { getBagsBase, getBagsApiKey, getBagsTimeoutMs } from "@/lib/env";
import type { BagsResult } from "@/lib/bags";

interface BagsCreateConfigRequest {
  launchWallet: string;
  tipWallet?: string;
  tipLamports?: number;
}

interface BagsCreateConfigResponse {
  configKey: string;
  tx: string | null;
}

/**
 * Create launch config via Bags API
 */
export async function createLaunchConfig(
  req: BagsCreateConfigRequest
): Promise<BagsResult<BagsCreateConfigResponse>> {
  const base = getBagsBase();
  const apiKey = getBagsApiKey();

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

  const url = base + "/token-launch/create-config";
  const timeoutMs = getBagsTimeoutMs();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-api-key": apiKey,
      Authorization: `Bearer ${apiKey}`,
    };

    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(req),
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
    const code =
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

  if (
    json &&
    typeof json === "object" &&
    json.success === false &&
    json.error
  ) {
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
    response: (json ?? (text as any)) as BagsCreateConfigResponse,
  };
}
