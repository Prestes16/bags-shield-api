/**
 * Common middleware for Launchpad endpoints
 * Handles feature flags, security headers, and logging
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getOrGenerateRequestId,
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
  SafeLogger,
} from "../security";
import { isLaunchpadEnabled } from "@/lib/env";

/**
 * Check if Launchpad is enabled and return error response if not
 */
export function checkLaunchpadEnabled(
  req: NextRequest,
  endpoint: string
): NextResponse | null {
  if (!isLaunchpadEnabled()) {
    const requestId = getOrGenerateRequestId(req.headers);
    SafeLogger.warn("Launchpad endpoint called but feature is disabled", {
      requestId,
      endpoint,
    });
    let res: Response = new NextResponse();
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
  return null;
}

/**
 * Apply common security headers and setup
 */
export function setupSecurityHeaders(
  req: NextRequest,
  requestId: string
): NextResponse {
    let res: Response = new NextResponse();
  res = applyCorsHeaders(req, res);
  res = applyNoStore(res);
  res = applySecurityHeaders(res);
  res.headers.set("X-Request-Id", requestId);
  return res;
}
