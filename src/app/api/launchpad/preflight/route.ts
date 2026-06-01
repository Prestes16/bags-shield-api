/**
 * POST /api/launchpad/preflight
 *
 * Read-only Launchpad safety preflight. This endpoint never signs, never
 * broadcasts, never returns a transaction for signing, and never persists a
 * token as created/launched.
 */

import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import {
  getOrGenerateRequestId,
  safeJsonParse,
  checkRateLimitByIp,
  checkIdempotencyKey,
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
  SafeLogger,
} from "@/lib/security";
import { handlePreflight } from "@/lib/security/cors";
import { getLaunchpadMode, isLaunchpadEnabled } from "@/lib/env";
import { buildLaunchpadFeeQuote } from "@/lib/launchpad/fees";
import {
  buildLaunchpadFeeSharePlan,
  validateFeeSharePlan,
  auditFeeSharePlan,
  type FeeSharePlanCheck,
} from "@/lib/launchpad/fee-share-plan";
import { isLaunchpadPublicWritesEnabled } from "@/lib/launchpad/safety";

const ROUTE = "/api/launchpad/preflight";
const PARTNER_CONFIG_ENV = "LAUNCHPAD_PARTNER_CONFIG";

interface SafePreflightRequest {
  wallet?: string;
  creatorWallet?: string;
  launchWallet?: string;
  initialBuyLamports?: number;
  verified?: boolean;
  tokenDraft?: {
    name?: string;
    symbol?: string;
    description?: string;
    metadataUri?: string;
  };
  config?: {
    launchWallet?: string;
    token?: {
      name?: string;
      symbol?: string;
      description?: string;
      metadataUri?: string;
    };
  };
}

function jsonResponse(req: NextRequest, requestId: string, body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set("X-Request-Id", requestId);
  return res;
}

function normalizePublicKey(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return new PublicKey(value.trim()).toBase58();
  } catch {
    return null;
  }
}

function getServerPartnerConfig() {
  return normalizePublicKey(process.env[PARTNER_CONFIG_ENV]);
}

function safeLamports(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function appendSafetyChecks(checks: FeeSharePlanCheck[]) {
  return [
    ...checks,
    {
      id: "tips_disabled",
      ok: true,
      message: "Tips are disabled by default",
    },
    {
      id: "no_partial_config_tx",
      ok: true,
      message: "No config transaction will be requested in public flow",
    },
  ];
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ["POST"]);
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = getOrGenerateRequestId(req.headers);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimitCheck = checkRateLimitByIp(ip, ROUTE);

  if (!rateLimitCheck.allowed) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded" },
        meta: { requestId },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": "20",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rateLimitCheck.resetAt),
        },
      },
    );
  }

  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const idempotencyCheck = checkIdempotencyKey(idempotencyKey, ROUTE);
    if (idempotencyCheck && !idempotencyCheck.allowed) {
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "IDEMPOTENCY_KEY_CONFLICT",
            message: "Request with this idempotency key already processed",
          },
          meta: { requestId },
        },
        { status: 409 },
      );
    }
  }

  const contentType = req.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json" },
        issues: [{ path: "headers.content-type", message: "Expected application/json" }],
        meta: { requestId },
      },
      { status: 415 },
    );
  }

  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch (error) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "BAD_REQUEST", message: "Failed to read request body" },
        issues: [{ path: "<root>", message: error instanceof Error ? error.message : "Unknown error" }],
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  const parseResult = safeJsonParse<SafePreflightRequest>(bodyText);
  if (!parseResult.success) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "BAD_REQUEST", message: parseResult.error || "Invalid JSON" },
        issues: parseResult.issues || [],
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  const body = parseResult.data || {};
  const wallet = normalizePublicKey(body.wallet || body.launchWallet || body.config?.launchWallet);
  const creatorWallet = normalizePublicKey(body.creatorWallet || wallet);

  if (!wallet || !creatorWallet) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "VALIDATION_FAILED", message: "wallet and creatorWallet must be valid Solana public keys" },
        issues: [{ path: "wallet", message: "wallet or launchWallet is required" }],
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  const initialBuyLamports = safeLamports(body.initialBuyLamports);
  const verified = body.verified === true;

  try {
    const feeShare = buildLaunchpadFeeSharePlan({ creatorWallet });
    const feeQuote = buildLaunchpadFeeQuote({
      wallet,
      verified,
      initialBuyLamports,
      extraTipLamports: 0,
    });
    const checks = appendSafetyChecks([
      ...validateFeeSharePlan(feeShare),
      ...auditFeeSharePlan(feeShare),
    ]);
    // Structural failures exclude warning-only checks so safetyStatus stays "paused".
    const structuralFailures = checks.filter((check) => !check.ok && !check.warning);
    const partnerConfig = getServerPartnerConfig();
    const mode = getLaunchpadMode();
    const publicWritesEnabled = isLaunchpadPublicWritesEnabled();
    const internalLaunchModeEnabled = publicWritesEnabled;
    const launchAllowed = isLaunchpadEnabled() && mode === "real" && publicWritesEnabled && Boolean(partnerConfig) && structuralFailures.length === 0;
    const safetyStatus = structuralFailures.length > 0
      ? "blocked_partial_config"
      : launchAllowed
        ? "internal_enabled"
        : publicWritesEnabled && !partnerConfig
          ? "partner_config_missing"
          : "paused";
    const reason = structuralFailures.length > 0
      ? "Launchpad fee-share configuration is not safe for public launch flow."
      : launchAllowed
        ? "Internal launch mode is enabled. Review the fee-share summary before signing."
        : publicWritesEnabled && !partnerConfig
          ? "Internal launch mode is enabled, but LAUNCHPAD_PARTNER_CONFIG is not configured yet."
          : "Launchpad writes are paused. Set LAUNCHPAD_PUBLIC_WRITES_ENABLED=true only in the internal environment to enable launches.";

    SafeLogger.info("Launchpad safety preflight completed", {
      requestId,
      endpoint: ROUTE,
      launchAllowed,
      safetyStatus,
      mode,
      failedChecks: structuralFailures.map((check) => check.id),
      internalLaunchModeEnabled,
      publicWritesEnabled,
      hasPartnerConfig: Boolean(partnerConfig),
    });

    return jsonResponse(req, requestId, {
      success: true,
      response: {
        launchAllowed,
        internalLaunchModeEnabled,
        publicWritesEnabled,
        safetyStatus,
        reason,
        mode,
        partnerConfig,
        tokenDraft: body.tokenDraft || body.config?.token || null,
        feeShare,
        tips: {
          enabled: false,
          tipWallet: null,
          tipLamports: 0,
        },
        estimatedCosts: {
          initialBuyLamports,
          totalPlatformFeeLamports: feeQuote.totalPlatformFeeLamports,
          networkFeeLamportsEstimate: null,
          partialConfigSpendAllowed: false,
        },
        checks,
      },
      meta: {
        requestId,
        elapsedMs: Date.now() - startTime,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Launchpad fee-share plan unavailable";
    const code = message.includes("LAUNCHPAD_FEE_SHARE_WALLET_NOT_CONFIGURED")
      ? "LAUNCHPAD_FEE_SHARE_WALLET_NOT_CONFIGURED"
      : "LAUNCHPAD_PREFLIGHT_FAILED";

    SafeLogger.error("Launchpad safety preflight failed", error, {
      requestId,
      endpoint: ROUTE,
      code,
    });

    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code, message },
        meta: { requestId, elapsedMs: Date.now() - startTime },
      },
      { status: 503 },
    );
  }
}
