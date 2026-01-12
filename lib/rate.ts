import type { VercelRequest, VercelResponse } from "@vercel/node";
import { tooManyRequests } from "./http";

/**
 * Rate limit entry tracking requests in a time window.
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limit store (best-effort for serverless).
 * Keys: "ip:route" (e.g., "192.168.1.1:/api/scan")
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Cleanup old entries periodically (best-effort).
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Get client IP from request (handles Vercel proxy headers).
 */
function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    const ips = forwarded.split(",").map((ip) => ip.trim());
    return ips[0] || "unknown";
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string") {
    return realIp;
  }
  return "unknown";
}

/**
 * Get route identifier from request URL.
 */
function getRoute(req: VercelRequest): string {
  return req.url?.split("?")[0] || "/";
}

/**
 * Check if rate limit is enabled (env vars present).
 */
export function isRateLimitEnabled(): boolean {
  const windowMs = process.env.RATE_LIMIT_WINDOW_MS;
  const max = process.env.RATE_LIMIT_MAX;
  return Boolean(windowMs && max && Number(windowMs) > 0 && Number(max) > 0);
}

/**
 * Get rate limit configuration from env (with defaults).
 */
function getRateLimitConfig(): { windowMs: number; max: number } | null {
  const windowMsRaw = process.env.RATE_LIMIT_WINDOW_MS;
  const maxRaw = process.env.RATE_LIMIT_MAX;

  if (!windowMsRaw || !maxRaw) {
    return null;
  }

  const windowMs = Number(windowMsRaw);
  const max = Number(maxRaw);

  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    return null;
  }
  if (!Number.isFinite(max) || max <= 0) {
    return null;
  }

  return { windowMs, max };
}

/**
 * Rate limit middleware.
 * Returns true if request should proceed, false if rate limited.
 * If rate limit is disabled (no env), always returns true.
 */
export function checkRateLimit(req: VercelRequest): boolean {
  const config = getRateLimitConfig();
  if (!config) {
    // Rate limiting disabled - allow all requests
    return true;
  }

  const { windowMs, max } = config;
  const ip = getClientIp(req);
  const route = getRoute(req);
  const key = `${ip}:${route}`;

  const now = Date.now();

  // Cleanup old entries occasionally (best-effort, not perfect)
  if (Math.random() < 0.1) {
    cleanupExpiredEntries();
  }

  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // New window or expired entry
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (entry.count >= max) {
    // Rate limit exceeded
    return false;
  }

  // Increment counter
  entry.count++;
  return true;
}

/**
 * Rate limit middleware that returns early with 429 if exceeded.
 * Use this in endpoint handlers.
 * Note: Assumes standard headers (CORS, X-Request-Id) are already set.
 */
export function rateLimitMiddleware(
  req: VercelRequest,
  res: VercelResponse
): boolean {
  if (req.method === "OPTIONS") {
    // Always allow OPTIONS (preflight)
    return true;
  }

  const allowed = checkRateLimit(req);
  if (!allowed) {
    // Get requestId from header (should be set by ensureRequestId before this)
    const requestId =
      (res as any).getHeader?.("X-Request-Id") as string | undefined;
    tooManyRequests(
      res,
      "Rate limit exceeded. Please try again later.",
      requestId
    );
    return false;
  }

  return true;
}
