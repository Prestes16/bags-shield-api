/**
 * Safe JSON parsing with size and depth limits
 * Prevents DoS attacks via deeply nested or large JSON payloads
 */

const MAX_JSON_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_JSON_DEPTH = 32;

export interface SafeJsonParseResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  issues?: Array<{ path: string; message: string }>;
}

/**
 * Calculate approximate JSON depth by counting nested brackets/braces
 */
function calculateJsonDepth(str: string): number {
  let depth = 0;
  let maxDepth = 0;
  for (const char of str) {
    if (char === "{" || char === "[") {
      depth++;
      maxDepth = Math.max(maxDepth, depth);
    } else if (char === "}" || char === "]") {
      depth--;
    }
  }
  return maxDepth;
}

/**
 * Safely parse JSON from text with size and depth limits
 */
export function safeJsonParse<T = unknown>(
  text: string
): SafeJsonParseResult<T> {
  // 1. Check size
  if (text.length > MAX_JSON_SIZE) {
    return {
      success: false,
      error: "JSON payload too large",
      issues: [
        {
          path: "<root>",
          message: `JSON payload exceeds maximum size of ${MAX_JSON_SIZE} bytes`,
        },
      ],
    };
  }

  // 2. Check depth before parsing
  const depth = calculateJsonDepth(text);
  if (depth > MAX_JSON_DEPTH) {
    return {
      success: false,
      error: "JSON nesting too deep",
      issues: [
        {
          path: "<root>",
          message: `JSON nesting depth (${depth}) exceeds maximum of ${MAX_JSON_DEPTH}`,
        },
      ],
    };
  }

  // 3. Parse JSON
  try {
    const data = JSON.parse(text) as T;
    return { success: true, data };
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? "Invalid JSON syntax"
        : error instanceof Error
          ? error.message
          : "Failed to parse JSON";

    return {
      success: false,
      error: message,
      issues: [
        {
          path: "<root>",
          message,
        },
      ],
    };
  }
}
