/**
 * Bags API client helpers for Launchpad
 */

import { getBagsBase, getBagsApiKey, getBagsTimeoutMs } from "@/lib/env";
import type { BagsResult } from "@/lib/bags";

/**
 * Request to create a launch transaction via Bags API.
 * Docs: POST /token-launch/create-launch-transaction
 */
interface BagsCreateLaunchTxRequest {
  /** IPFS URI for the token metadata (from create-token-info step) */
  ipfs: string;
  /** The token mint address (base58) */
  tokenMint: string;
  /** Creator wallet address (base58) */
  wallet: string;
  /** Amount in lamports to use as initial buy */
  initialBuyLamports?: number;
  /** Config key returned from fee-share/config registration (optional) */
  configKey?: string;
  /** Tip wallet for Bags (optional) */
  tipWallet?: string;
  /** Tip amount in lamports (optional) */
  tipLamports?: number;
}

interface BagsCreateLaunchTxResponse {
  tx: string;
  configKey: string;
}

/**
 * Create a launch transaction via Bags API.
 * Docs: POST /token-launch/create-launch-transaction
 */
export async function createLaunchConfig(
  req: BagsCreateLaunchTxRequest
): Promise<BagsResult<BagsCreateLaunchTxResponse>> {
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

  const url = base + "/token-launch/create-launch-transaction";
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
      // keep as text
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
    response: (json ?? (text as any)) as BagsCreateLaunchTxResponse,
  };
}

// ---------------------------------------------------------------------------
// Fee-share config registration
// ---------------------------------------------------------------------------

interface BagsRegisterFeeShareRequest {
  /** The wallet that is launching the token */
  launchWallet: string;
  /** The wallet that receives the fee-share royalties (defaults to launchWallet) */
  feeShareWallet?: string;
  /** Optional tip wallet */
  tipWallet?: string;
  /** Optional tip in lamports */
  tipLamports?: number;
}

interface BagsRegisterFeeShareResponse {
  configKey: string;
  tx: string | null;
}

/**
 * Register a fee-share config with Bags API.
 * Docs: POST /fee-share/config
 * Gives the creator wallet 1% royalties from trades on Bags.fm.
 */
export async function registerFeeShare(
  req: BagsRegisterFeeShareRequest
): Promise<BagsResult<BagsRegisterFeeShareResponse>> {
  const base = getBagsBase();
  const apiKey = getBagsApiKey();

  if (!base || !apiKey) {
    return {
      success: false,
      error: {
        code: "BAGS_NOT_CONFIGURED",
        details: { base, hasApiKey: Boolean(apiKey) },
      },
    };
  }

  const url = base + "/fee-share/config";
  const timeoutMs = getBagsTimeoutMs();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;

  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
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
    } catch { /* keep as text */ }
  }

  if (!res.ok) {
    return {
      success: false,
      error: {
        code: res.status === 429 ? "UPSTREAM_RATE_LIMITED" : "UPSTREAM_BAD_RESPONSE",
        details: { status: res.status, statusText: res.statusText, url, body: json ?? text },
      },
    };
  }

  if (json && typeof json === "object" && json.success === false && json.error) {
    return {
      success: false,
      error: { code: json.error.code ?? "UPSTREAM_BAD_RESPONSE", details: json.error },
    };
  }

  return {
    success: true,
    response: (json ?? (text as any)) as BagsRegisterFeeShareResponse,
  };
}
