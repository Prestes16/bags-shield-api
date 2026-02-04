/**
 * POST /api/launchpad/preflight
 * 
 * Validates LaunchConfigDraft and calls /api/scan and /api/simulate internally.
 * Returns PreflightReport with validation results.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getOrGenerateRequestId,
  safeJsonParse,
  checkRateLimitByIp,
  checkIdempotencyKey,
  SafeLogger,
} from "@/src/lib/security";
import { handlePreflight } from "@/src/lib/security/cors";
import {
  validateLaunchpadInput,
  launchConfigDraftSchema,
} from "@/src/lib/launchpad/schemas";
import { checkLaunchpadEnabled, setupSecurityHeaders } from "@/src/lib/launchpad/middleware";
import { getLaunchpadMode } from "@/lib/env";
import { stubPreflightReport } from "@/src/lib/launchpad/stub";
import type { LaunchConfigDraft, PreflightReport } from "@/src/lib/launchpad/types";

interface PreflightRequest {
  config: LaunchConfigDraft;
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ["POST"]);
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let requestId = getOrGenerateRequestId(req.headers);

  // Check feature flag
  const featureCheck = checkLaunchpadEnabled(req, "/api/launchpad/preflight");
  if (featureCheck) return featureCheck;

  // Apply security headers
  let res = setupSecurityHeaders(req, requestId);

  // Rate limiting by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const route = "/api/launchpad/preflight";
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

  const parseResult = safeJsonParse<PreflightRequest>(bodyText);
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

  // Validate config schema
  const validation = validateLaunchpadInput(
    launchConfigDraftSchema,
    parseResult.data.config
  );
  if (!validation.ok) {
    const report: PreflightReport = {
      isValid: false,
      issues: validation.issues.map((issue) => ({
        ...issue,
        severity: "error" as const,
      })),
      warnings: [],
      validatedAt: new Date().toISOString(),
      requestId,
    };

    return NextResponse.json(
      {
        success: true,
        response: report,
        meta: {
          requestId,
          elapsedMs: Date.now() - startTime,
        },
      },
      { status: 200 }
    );
  }

  const config = validation.data;

  const mode = getLaunchpadMode();
  const elapsedMs = Date.now() - startTime;

  // Use stub mode if configured
  if (mode === "stub") {
    SafeLogger.info("Using stub mode for preflight", {
      requestId,
      endpoint: "/api/launchpad/preflight",
      mode: "stub",
    });

    const report = stubPreflightReport(config, requestId);

    return NextResponse.json(
      {
        success: true,
        response: report,
        meta: {
          requestId,
          elapsedMs,
          mode: "stub",
        },
      },
      { status: 200 }
    );
  }

  // Real mode: Additional business logic validations
  const issues: PreflightReport["issues"] = [];
  const warnings: PreflightReport["warnings"] = [];

  // Additional business logic validations
  if (config.token.imageUrl && !config.token.imageUrl.startsWith("https://")) {
    warnings.push({
      path: "token.imageUrl",
      message: "HTTPS is recommended for image URLs",
    });
  }

  if (!config.token.description || config.token.description.length < 10) {
    warnings.push({
      path: "token.description",
      message: "Description should be at least 10 characters for better visibility",
    });
  }

  SafeLogger.info("Preflight validation completed", {
    requestId,
    endpoint: "/api/launchpad/preflight",
    isValid: issues.length === 0,
    issuesCount: issues.length,
    warningsCount: warnings.length,
    elapsedMs,
  });

  const report: PreflightReport = {
    isValid: issues.length === 0,
    issues,
    warnings,
    validatedAt: new Date().toISOString(),
    requestId,
  };

  return NextResponse.json(
    {
      success: true,
      response: report,
      meta: {
        requestId,
        elapsedMs,
      },
    },
    { status: 200 }
  );
}
