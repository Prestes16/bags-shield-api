/**
 * CORS utilities for restrictive CORS policy
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorsOrigins } from "../../../lib/env";

/**
 * Hardcoded baseline origins — mirrors src/middleware.ts ALLOWED_ORIGINS.
 * These are always allowed regardless of the CORS_ORIGINS env var.
 */
const BASELINE_ORIGINS = [
  "https://app.bagsshield.org",
  "https://bags-shield-app2.vercel.app",
  "https://bags-shield-api.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
];

/**
 * Get allowed origin based on request.
 * Merges hardcoded baseline with CORS_ORIGINS env var so per-route handlers
 * never override the correct middleware header with a wrong fallback.
 */
function getAllowedOrigin(req: NextRequest): string {
  try {
    const requestOrigin = req.headers.get("origin");

    // Build the full allowed list: baseline + env var additions
    const corsOrigins = getCorsOrigins();
    const envOrigins: string[] = Array.isArray(corsOrigins)
      ? corsOrigins
      : typeof corsOrigins === "string" && corsOrigins !== "*"
        ? [corsOrigins]
        : [];

    const allAllowed = Array.from(new Set([...BASELINE_ORIGINS, ...envOrigins]));

    if (requestOrigin && allAllowed.includes(requestOrigin)) {
      return requestOrigin;
    }

    // In non-production, allow any Vercel preview URL
    if (
      requestOrigin &&
      requestOrigin.endsWith(".vercel.app") &&
      process.env.VERCEL_ENV !== "production"
    ) {
      return requestOrigin;
    }

    return allAllowed[0];
  } catch {
    return "*";
  }
}

/**
 * Apply CORS headers to response
 */
export function applyCorsHeaders(
  req: NextRequest,
  res: Response
): Response {
  const allowedOrigin = getAllowedOrigin(req);
  res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  res.headers.set("Access-Control-Expose-Headers", "X-Request-Id");
  return res;
}

/**
 * Handle OPTIONS preflight request
 */
export function handlePreflight(
  req: NextRequest,
  allowedMethods: string[] = ["POST"],
  allowedHeaders: string[] = [
    "Content-Type",
    "Authorization",
    "x-api-key",
    "X-Request-Id",
    "Idempotency-Key",
  ]
): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  applyCorsHeaders(req, res);
  res.headers.set("Access-Control-Allow-Methods", allowedMethods.join(","));
  res.headers.set(
    "Access-Control-Allow-Headers",
    allowedHeaders.join(",")
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
}
