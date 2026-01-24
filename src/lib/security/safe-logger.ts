/**
 * Safe logger - structured logging without sensitive data
 * Never logs secrets, env vars, or sensitive information
 */

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /api[_-]?key/i,
  /auth/i,
  /credential/i,
  /bearer/i,
  /authorization/i,
];

/**
 * Check if a string looks like a secret
 */
function looksLikeSecret(value: string): boolean {
  // Check for env var patterns
  if (value.startsWith("process.env.")) {
    return true;
  }

  // Check for common secret patterns
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(value))) {
    return true;
  }

  // Check for very long strings that might be tokens
  if (value.length > 100 && /^[A-Za-z0-9+/=]+$/.test(value)) {
    return true;
  }

  return false;
}

/**
 * Sanitize a value for logging
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (looksLikeSecret(value)) {
      return "[REDACTED: sensitive data]";
    }
    return value;
  }

  if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(key))) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitizeValue(val);
      }
    }
    return sanitized;
  }

  return value;
}

export interface LogContext {
  requestId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  elapsedMs?: number;
  [key: string]: unknown;
}

/**
 * Structured logger that never logs sensitive data
 */
export class SafeLogger {
  /**
   * Log info level
   */
  static info(message: string, context?: LogContext): void {
    const sanitized = context ? sanitizeValue(context) : {};
    console.log(
      JSON.stringify({
        level: "info",
        message,
        timestamp: new Date().toISOString(),
        ...(typeof sanitized === 'object' && sanitized ? sanitized : {}),
      })
    );
  }

  /**
   * Log error level
   */
  static error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorData: Record<string, unknown> = {};
    if (error instanceof Error) {
      errorData.error = {
        name: error.name,
        message: error.message,
        // Never log stack traces in production
        stack:
          process.env.NODE_ENV === "development"
            ? error.stack
            : "[REDACTED: stack trace]",
      };
    } else if (error) {
      errorData.error = sanitizeValue(error);
    }

    const sanitized = context ? sanitizeValue(context) : {};
    console.error(
      JSON.stringify({
        level: "error",
        message,
        timestamp: new Date().toISOString(),
        ...errorData,
        ...(typeof sanitized === 'object' && sanitized ? sanitized : {}),
      })
    );
  }

  /**
   * Log warning level
   */
  static warn(message: string, context?: LogContext): void {
    const sanitized = context ? sanitizeValue(context) : {};
    console.warn(
      JSON.stringify({
        level: "warn",
        message,
        timestamp: new Date().toISOString(),
        ...(typeof sanitized === 'object' && sanitized ? sanitized : {}),
      })
    );
  }

  /**
   * Log debug level (only in development)
   */
  static debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== "development") {
      return;
    }
    const sanitized = context ? sanitizeValue(context) : {};
    console.debug(
      JSON.stringify({
        level: "debug",
        message,
        timestamp: new Date().toISOString(),
        ...(typeof sanitized === 'object' && sanitized ? sanitized : {}),
      })
    );
  }
}
