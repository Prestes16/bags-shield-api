/**
 * Security headers utilities
 * Applies security headers to responses
 */

import type { NextResponse } from "next/server";

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(res: Response): Response {
  // X-Content-Type-Options: Prevent MIME type sniffing
  res.headers.set("X-Content-Type-Options", "nosniff");

  // Referrer-Policy: Control referrer information
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // X-Frame-Options: Prevent clickjacking
  res.headers.set("X-Frame-Options", "DENY");

  // Permissions-Policy: Restrict browser features
  res.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
  );

  // X-XSS-Protection: Legacy XSS protection (for older browsers)
  res.headers.set("X-XSS-Protection", "1; mode=block");

  // Strict-Transport-Security: Force HTTPS (only in production)
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return res;
}
