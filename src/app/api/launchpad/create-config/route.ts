/**
 * POST /api/launchpad/create-config
 *
 * Creates a Bags fee-share configuration for Launch v2. The creator/payer
 * must be explicitly included and the BPS total must be exactly 10000.
 */

import { NextRequest, NextResponse } from "next/server";
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
import {
  bagsFeeShareConfigRequestSchema,
  validateLaunchpadInput,
} from "@/lib/launchpad/schemas";
import {
  createFeeShareConfig,
  type BagsFeeShareConfigRequest,
} from "@/lib/launchpad/bags-client";
import { buildLaunchpadFeeShare } from "@/lib/launchpad/fees";
import { getLaunchpadMode, isLaunchpadEnabled } from "@/lib/env";
import {
  isLaunchpadPublicWritesPaused,
  LAUNCHPAD_SAFE_MODE_PAUSED_CODE,
  LAUNCHPAD_SAFE_MODE_PAUSED_MESSAGE,
} from "@/lib/launchpad/safety";

const ROUTE = "/api/launchpad/create-config";

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ["POST"]);
}

function jsonResponse(req: NextRequest, requestId: string, body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set("X-Request-Id", requestId);
  return res;
}

function pickConfigKey(response: Record<string, unknown>) {
  const configKey = response.configKey;
  if (typeof configKey === "string" && configKey.trim()) return configKey;

  const meteoraConfigKey = response.meteoraConfigKey;
  if (typeof meteoraConfigKey === "string" && meteoraConfigKey.trim()) return meteoraConfigKey;

  return undefined;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = getOrGenerateRequestId(req.headers);

  if (!isLaunchpadEnabled()) {
    SafeLogger.warn("Launchpad create-config called while disabled", { requestId, endpoint: ROUTE });
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "FEATURE_DISABLED", message: "Launchpad feature is not enabled" },
        meta: { requestId },
      },
      { status: 503 },
    );
  }

  if (getLaunchpadMode() !== "real") {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: "LAUNCHPAD_REAL_MODE_REQUIRED",
          message: "Launchpad Bags integration is not enabled in real mode",
        },
        meta: { requestId },
      },
      { status: 503 },
    );
  }

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

  const parseResult = safeJsonParse<unknown>(bodyText);
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

  const validation = validateLaunchpadInput(bagsFeeShareConfigRequestSchema, parseResult.data);
  if (!validation.ok) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "VALIDATION_FAILED", message: "Request validation failed" },
        issues: "issues" in validation ? validation.issues : [],
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  if (isLaunchpadPublicWritesPaused()) {
    SafeLogger.warn("Launchpad create-config blocked by server-side Safety Gate", {
      requestId,
      endpoint: ROUTE,
    });
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: LAUNCHPAD_SAFE_MODE_PAUSED_CODE,
          message: LAUNCHPAD_SAFE_MODE_PAUSED_MESSAGE,
        },
        meta: { requestId, elapsedMs: Date.now() - startTime },
      },
      { status: 423 },
    );
  }

  try {
    const input = ("data" in validation ? validation.data : {}) as BagsFeeShareConfigRequest;
    let feeShare: ReturnType<typeof buildLaunchpadFeeShare>;
    try {
      feeShare = buildLaunchpadFeeShare(input.payer);
    } catch (error) {
      SafeLogger.error("Launchpad fee-share configuration unavailable", error, {
        requestId,
        endpoint: ROUTE,
      });
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "FEE_CONFIGURATION_UNAVAILABLE",
            message: error instanceof Error ? error.message : "Launchpad fee-share configuration is unavailable",
          },
          meta: { requestId, elapsedMs: Date.now() - startTime },
        },
        { status: 503 },
      );
    }

    const config: BagsFeeShareConfigRequest = {
      payer: input.payer,
      baseMint: input.baseMint,
      claimersArray: feeShare.claimersArray,
      basisPointsArray: feeShare.basisPointsArray,
      ...(input.bagsConfigType ? { bagsConfigType: input.bagsConfigType } : {}),
      ...(input.partner ? { partner: input.partner } : {}),
      ...(input.partnerConfig ? { partnerConfig: input.partnerConfig } : {}),
      ...(input.additionalLookupTables ? { additionalLookupTables: input.additionalLookupTables } : {}),
    };

    const bagsResult = await createFeeShareConfig(config);

    if ("error" in bagsResult) {
      SafeLogger.error("Bags fee-share config request failed", undefined, {
        requestId,
        endpoint: ROUTE,
        errorCode: bagsResult.error.code,
      });

      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: { code: bagsResult.error.code, message: bagsResult.error.message },
          meta: { requestId, upstream: "bags", elapsedMs: Date.now() - startTime },
        },
        { status: bagsResult.error.code === "BAGS_NOT_CONFIGURED" ? 503 : 502 },
      );
    }

    const upstreamResponse = bagsResult.response as Record<string, unknown>;
    const configKey = pickConfigKey(upstreamResponse);
    const transactions = Array.isArray(upstreamResponse.transactions) ? upstreamResponse.transactions : [];
    const bundles = Array.isArray(upstreamResponse.bundles) ? upstreamResponse.bundles : [];
    const hasTransactions = transactions.length > 0;
    const hasBundles = bundles.length > 0;
    const needsCreation = upstreamResponse.needsCreation === true || hasTransactions || hasBundles;
    const publicFlowSafe = !hasTransactions && !hasBundles;

    return jsonResponse(
      req,
      requestId,
      {
        success: true,
        response: {
          ...upstreamResponse,
          configKey,
          meteoraConfigKey: upstreamResponse.meteoraConfigKey || configKey,
          needsCreation,
          hasTransactions,
          hasBundles,
          publicFlowSafe,
          safety: {
            publicFlowSafe,
            needsCreation,
            hasTransactions,
            hasBundles,
            reason: publicFlowSafe
              ? "Fee-share config does not require a separate public-flow signature."
              : "Fee-share config returned separate transactions/bundles and is unsafe for public launch flow while Safety Gate is active.",
          },
          feeShare: {
            feesEnabled: feeShare.feesEnabled,
            treasuryWallet: feeShare.treasuryWallet,
            claimersArray: feeShare.claimersArray,
            basisPointsArray: feeShare.basisPointsArray,
            creatorFeeShareBps: feeShare.creatorFeeShareBps,
            bagsShieldFeeShareBps: feeShare.bagsShieldFeeShareBps,
            totalBps: feeShare.totalBps,
          },
        },
        meta: {
          requestId,
          upstream: "bags",
          upstreamStatus: 200,
          elapsedMs: Date.now() - startTime,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    SafeLogger.error("Internal error creating Bags fee-share config", error, {
      requestId,
      endpoint: ROUTE,
      elapsedMs: Date.now() - startTime,
    });

    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        meta: { requestId, elapsedMs: Date.now() - startTime },
      },
      { status: 500 },
    );
  }
}
