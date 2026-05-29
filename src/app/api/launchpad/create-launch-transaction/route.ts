/**
 * POST /api/launchpad/create-launch-transaction
 *
 * Requests an unsigned serialized Launch v2 transaction from Bags. The
 * backend never signs on behalf of the user.
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
  bagsCreateLaunchTransactionRequestSchema,
  validateLaunchpadInput,
} from "@/lib/launchpad/schemas";
import {
  createLaunchTransaction,
  type BagsCreateLaunchTransactionRequest,
} from "@/lib/launchpad/bags-client";
import { buildLaunchpadFeeQuote } from "@/lib/launchpad/fees";
import { getLaunchpadMode, isLaunchpadEnabled } from "@/lib/env";
import { upsertUserLaunchProvenance } from "@/lib/launchpad/launch-registry";

const ROUTE = "/api/launchpad/create-launch-transaction";

function compactKey(value?: string) {
  if (!value) return undefined;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function getUpstreamStatus(details?: Record<string, unknown>) {
  const status = details?.status;
  return typeof status === "number" ? status : undefined;
}

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

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = getOrGenerateRequestId(req.headers);

  if (!isLaunchpadEnabled()) {
    SafeLogger.warn("Launchpad create-launch-transaction called while disabled", {
      requestId,
      endpoint: ROUTE,
    });
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

  const validation = validateLaunchpadInput(bagsCreateLaunchTransactionRequestSchema, parseResult.data);
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

  const input = ("data" in validation ? validation.data : {}) as BagsCreateLaunchTransactionRequest & {
    metadataUri?: string;
    metadataUrl?: string;
    verified?: boolean;
    extraTipLamports?: number;
  };
  const finalIpfs = input.ipfs || input.metadataUri || input.metadataUrl;

  if (!finalIpfs) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "VALIDATION_FAILED", message: "Request validation failed" },
        issues: [{ path: "ipfs", message: "ipfs or metadataUri is required" }],
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  try {
    let feeQuote: ReturnType<typeof buildLaunchpadFeeQuote>;
    try {
      feeQuote = buildLaunchpadFeeQuote({
        wallet: input.wallet,
        verified: input.verified,
        initialBuyLamports: input.initialBuyLamports,
        extraTipLamports: input.extraTipLamports,
      });
    } catch (error) {
      SafeLogger.error("Launchpad platform fee unavailable", error, {
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
            message: error instanceof Error ? error.message : "Platform fee collection is not available; launch disabled until fee mode is configured.",
          },
          meta: { requestId, elapsedMs: Date.now() - startTime },
        },
        { status: 503 },
      );
    }

    const feeFields: { tipWallet?: string; tipLamports?: number } =
      feeQuote.feesEnabled && feeQuote.totalTipLamports > 0
        ? {
            tipWallet: feeQuote.treasuryWallet,
            tipLamports: feeQuote.totalTipLamports,
          }
        : {};

    SafeLogger.warn("Bags create-launch-transaction payload shape", {
      requestId,
      endpoint: ROUTE,
      hasIpfs: Boolean(finalIpfs),
      ipfsLength: finalIpfs?.length ?? 0,
      ipfsPrefix: finalIpfs?.slice(0, 12) ?? "",
      initialBuyLamports: input.initialBuyLamports,
      hasTokenMint: Boolean(input.tokenMint),
      hasWallet: Boolean(input.wallet),
      hasConfigKey: Boolean(input.configKey),
      configKeyLength: input.configKey?.length ?? 0,
      hasTipWallet: Boolean(feeFields.tipWallet),
      tipLamports: feeFields.tipLamports ?? 0,
    });

    const bagsResult = await createLaunchTransaction({
      ipfs: finalIpfs,
      tokenMint: input.tokenMint,
      wallet: input.wallet,
      initialBuyLamports: input.initialBuyLamports,
      configKey: input.configKey,
      ...feeFields,
    });

    if ("error" in bagsResult) {
      const upstreamStatus = getUpstreamStatus(bagsResult.error.details);
      SafeLogger.error("Bags create-launch-transaction request failed", undefined, {
        requestId,
        endpoint: ROUTE,
        errorCode: bagsResult.error.code,
        upstreamStatus,
        wallet: input.wallet,
        tokenMint: input.tokenMint,
        hasIpfs: Boolean(finalIpfs),
        configKey: compactKey(input.configKey),
        initialBuyLamports: input.initialBuyLamports,
        tipLamports: feeFields.tipLamports ?? 0,
      });

      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "BAGS_CREATE_LAUNCH_TRANSACTION_FAILED",
            message: bagsResult.error.message,
            upstreamStatus,
          },
          meta: { requestId, upstream: "bags", upstreamStatus, elapsedMs: Date.now() - startTime },
        },
        {
          status: bagsResult.error.code === "BAGS_NOT_CONFIGURED"
            ? 503
            : upstreamStatus === 400 || upstreamStatus === 422
              ? upstreamStatus
              : 502,
        },
      );
    }

    const persisted = await upsertUserLaunchProvenance({
      mint: input.tokenMint,
      creatorWallet: input.wallet,
      launchWallet: input.wallet,
      metadataUri: finalIpfs,
      configKey: input.configKey,
      launchStatus: "transaction_created",
    });
    if (!persisted) {
      SafeLogger.warn("Launchpad transaction provenance was not persisted", {
        requestId,
        endpoint: ROUTE,
        tokenMint: input.tokenMint,
        hasWallet: Boolean(input.wallet),
      });
    }

    return jsonResponse(
      req,
      requestId,
      {
        success: true,
        response: {
          transaction: bagsResult.response,
          encoding: "base58",
          tokenMint: input.tokenMint,
          metadataUri: finalIpfs,
          configKey: input.configKey,
          tipWallet: feeFields.tipWallet,
          tipLamports: feeFields.tipLamports ?? 0,
          feeQuote,
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
    SafeLogger.error("Internal error creating Bags launch transaction", error, {
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
