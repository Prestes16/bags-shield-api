/**
 * Request ID utilities for security and tracing
 */

/**
 * Generate a unique request ID (UUID v4 preferred, fallback to random)
 */
export function generateRequestId(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  // Fallback: generate pseudo-random ID
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Extract request ID from headers or generate new one
 */
export function getOrGenerateRequestId(
  headers: Headers | Record<string, string | string[] | undefined>
): string {
  const headerValue =
    headers instanceof Headers
      ? headers.get("x-request-id")
      : Array.isArray(headers["x-request-id"])
        ? headers["x-request-id"][0]
        : headers["x-request-id"];

  if (typeof headerValue === "string" && headerValue.trim().length > 0) {
    return headerValue.trim();
  }

  return generateRequestId();
}
