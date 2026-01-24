/**
 * Rate limiting utilities with in-memory store (best-effort for serverless)
 * Supports both IP-based and requestId-based (idempotency) rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (best-effort, cleared on cold start)
const rateLimitStore = new Map<string, RateLimitEntry>();

const CLEANUP_PROBABILITY = 0.1; // 10% chance to cleanup on each check

/**
 * Cleanup expired entries periodically
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
 * Get client IP from request headers (handles Vercel proxy)
 */
export function getClientIp(
  headers: Headers | Record<string, string | string[] | undefined>
): string {
  if (headers instanceof Headers) {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      const ips = forwarded.split(",").map((ip) => ip.trim());
      return ips[0] || "unknown";
    }
    const realIp = headers.get("x-real-ip");
    if (realIp) {
      return realIp;
    }
  } else {
    const forwarded = headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      const ips = forwarded.split(",").map((ip) => ip.trim());
      return ips[0] || "unknown";
    }
    const realIp = headers["x-real-ip"];
    if (typeof realIp === "string") {
      return realIp;
    }
  }
  return "unknown";
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
}

/**
 * Default rate limit config (light rate limiting)
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60000, // 1 minute
  max: 20, // 20 requests per minute
};

/**
 * Check rate limit for a given key
 */
function checkRateLimitForKey(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();

  // Cleanup occasionally
  if (Math.random() < CLEANUP_PROBABILITY) {
    cleanupExpiredEntries();
  }

  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // New window or expired entry
    const resetAt = now + config.windowMs;
    rateLimitStore.set(key, {
      count: 1,
      resetAt,
    });
    return { allowed: true, remaining: config.max - 1, resetAt };
  }

  if (entry.count >= config.max) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // Increment counter
  entry.count++;
  return {
    allowed: true,
    remaining: config.max - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Check rate limit by IP address
 */
export function checkRateLimitByIp(
  ip: string,
  route: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = `ip:${ip}:${route}`;
  return checkRateLimitForKey(key, config);
}

/**
 * Check rate limit by requestId (for idempotency)
 */
export function checkRateLimitByRequestId(
  requestId: string,
  route: string,
  config: RateLimitConfig = { windowMs: 3600000, max: 1 } // 1 hour, 1 request
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = `idempotency:${requestId}:${route}`;
  return checkRateLimitForKey(key, config);
}

/**
 * Check rate limit by Idempotency-Key header
 */
export function checkIdempotencyKey(
  idempotencyKey: string | null | undefined,
  route: string
): { allowed: boolean; remaining: number; resetAt: number } | null {
  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    return null; // No idempotency key provided
  }

  return checkRateLimitByRequestId(idempotencyKey.trim(), route);
}
