/**
 * CORS utilities for restrictive CORS policy
 */

import type { NextRequest, NextResponse } from "next/server";
import { getCorsOrigins } from "../../../lib/env";

/**
 * Get allowed origin based on request
 */
function getAllowedOrigin(req: NextRequest): string {
  try {
    const corsOrigins = getCorsOrigins();
    if (Array.isArray(corsOrigins)) {
      const requestOrigin = req.headers.get("origin");
      if (requestOrigin && corsOrigins.includes(requestOrigin)) {
        return requestOrigin;
      }
      return corsOrigins[0] || "*";
    }
    if (typeof corsOrigins === "string") {
      return corsOrigins;
    }
    return "*";
  } catch (error) {
    // Fallback seguro em caso de erro
    return "*";
  }
}

/**
 * Apply CORS headers to response
 */
export function applyCorsHeaders(
  req: NextRequest,
  res: NextResponse
): NextResponse {
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
