/**
 * POST /api/launchpad/token-info
 * 
 * Validates TokenDraft and proxies to Bags create-token-info endpoint.
 * Prioritizes imageUrl to avoid multipart in v1.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getOrGenerateRequestId,
  safeJsonParse,
  checkRateLimitByIp,
  checkIdempotencyKey,
  applyCorsHeaders,
  applyNoStore,
  SafeLogger,
  applySecurityHeaders,
} from "@/src/lib/security";
import { handlePreflight } from "@/src/lib/security/cors";
import { validateLaunchpadInput, tokenDraftSchema } from "@/src/lib/launchpad/schemas";
import { isLaunchpadEnabled, getLaunchpadMode } from "@/lib/env";
import { createTokenInfo } from "@/lib/bags";
import { stubCreateTokenInfo } from "@/src/lib/launchpad/stub";
import type { TokenDraft } from "@/src/lib/launchpad/types";

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ["POST"]);
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let requestId = getOrGenerateRequestId(req.headers);

  // Check feature flag
  if (!isLaunchpadEnabled()) {
    SafeLogger.warn("Launchpad endpoint called but feature is disabled", {
      requestId,
      endpoint: "/api/launchpad/token-info",
    });
    let res = new NextResponse();
    res = applyCorsHeaders(req, res);
    res = applyNoStore(res);
    res = applySecurityHeaders(res);
    res.headers.set("X-Request-Id", requestId);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FEATURE_DISABLED",
          message: "Launchpad feature is not enabled",
        },
        meta: { requestId },
      },
      { status: 503 }
    );
  }

  // Apply security headers
  let res = new NextResponse();
  res = applyCorsHeaders(req, res);
  res = applyNoStore(res);
  res = applySecurityHeaders(res);
  res.headers.set("X-Request-Id", requestId);

  // Rate limiting by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const route = "/api/launchpad/token-info";
  const rateLimitCheck = checkRateLimitByIp(ip, route);
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Rate limit exceeded",
        },
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
      }
    );
  }

  // Idempotency check (optional)
  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const idempotencyCheck = checkIdempotencyKey(idempotencyKey, route);
    if (idempotencyCheck && !idempotencyCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "IDEMPOTENCY_KEY_CONFLICT",
            message: "Request with this idempotency key already processed",
          },
          meta: { requestId },
        },
        { status: 409 }
      );
    }
  }

  // Content-Type check
  const contentType = req.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Content-Type must be application/json",
        },
        issues: [
          {
            path: "headers.content-type",
            message: "Expected application/json",
          },
        ],
        meta: { requestId },
      },
      { status: 415 }
    );
  }

  // Safe JSON parsing
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Failed to read request body",
        },
        issues: [
          {
            path: "<root>",
            message: error instanceof Error ? error.message : "Unknown error",
          },
        ],
        meta: { requestId },
      },
      { status: 400 }
    );
  }

  const parseResult = safeJsonParse<TokenDraft>(bodyText);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: parseResult.error || "Invalid JSON",
        },
        issues: parseResult.issues || [],
        meta: { requestId },
      },
      { status: 400 }
    );
  }

  // Validate schema
  const validation = validateLaunchpadInput(tokenDraftSchema, parseResult.data);
  if (!validation.ok) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "Request validation failed",
        },
        issues: ("issues" in validation ? validation.issues : []),
        meta: { requestId },
      },
      { status: 400 }
    );
  }

  const tokenDraft = validation.data;

  const mode = getLaunchpadMode();
  const elapsedMs = Date.now() - startTime;

  // Use stub mode if configured
  if (mode === "stub") {
    SafeLogger.info("Using stub mode for token-info", {
      requestId,
      endpoint: "/api/launchpad/token-info",
      mode: "stub",
    });

    const stubResponse = stubCreateTokenInfo(tokenDraft, requestId);

    return NextResponse.json(
      {
        success: true,
        response: stubResponse,
        meta: {
          requestId,
          upstream: "stub",
          upstreamStatus: 200,
          elapsedMs,
          mode: "stub",
        },
      },
      { status: 201 }
    );
  }

  // Real mode: Proxy to Bags API
  try {
    SafeLogger.info("Calling Bags API for token-info", {
      requestId,
      endpoint: "/api/launchpad/token-info",
      mode: "real",
    });

    const bagsResult = await createTokenInfo({
      name: tokenDraft.name,
      symbol: tokenDraft.symbol,
      description: tokenDraft.description,
      imageUrl: tokenDraft.imageUrl, // Prioritize imageUrl
      website: tokenDraft.websiteUrl,
      twitter: tokenDraft.twitterHandle,
      telegram: tokenDraft.telegramHandle,
    });

    if (!bagsResult.success) {
      SafeLogger.error("Bags API error", undefined, {
        requestId,
        endpoint: "/api/launchpad/token-info",
        errorCode: bagsResult.error.code,
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: bagsResult.error.code || "UPSTREAM_ERROR",
            message: "Failed to create token info",
          },
          meta: {
            requestId,
            upstream: "bags",
            upstreamStatus: 500,
            elapsedMs,
          },
        },
        { status: 502 }
      );
    }

    SafeLogger.info("Token info created successfully", {
      requestId,
      endpoint: "/api/launchpad/token-info",
      elapsedMs,
    });

    return NextResponse.json(
      {
        success: true,
        response: bagsResult.response,
        meta: {
          requestId,
          upstream: "bags",
          upstreamStatus: 200,
          elapsedMs,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    SafeLogger.error("Internal error creating token info", error, {
      requestId,
      endpoint: "/api/launchpad/token-info",
      elapsedMs,
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error",
        },
        meta: {
          requestId,
          elapsedMs,
        },
      },
      { status: 500 }
    );
  }
}
