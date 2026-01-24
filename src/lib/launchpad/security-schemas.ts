/**
 * Security-hardened schemas for Launchpad endpoints
 * All user inputs are sanitized and validated
 */

import { z } from "zod";
import { LaunchpadSecuritySchemas } from "./sanitization";

/**
 * Submit token launch request schema (PR0)
 * Basic structure for security validation
 */
export const SubmitRequestSchema = z.object({
  /** Token information */
  token: z.object({
    name: LaunchpadSecuritySchemas.tokenName,
    symbol: LaunchpadSecuritySchemas.tokenSymbol, 
    decimals: LaunchpadSecuritySchemas.tokenDecimals,
    description: LaunchpadSecuritySchemas.description,
    imageUrl: LaunchpadSecuritySchemas.safeUrl.optional(),
    websiteUrl: LaunchpadSecuritySchemas.safeUrl.optional(),
    twitterHandle: LaunchpadSecuritySchemas.twitterHandle,
    telegramHandle: z.string().optional()
      .transform(val => val ? val.trim() : null)
      .refine(val => !val || /^[a-zA-Z0-9_]{1,32}$/.test(val), "Invalid Telegram handle"),
  }),
  
  /** Launch configuration */
  launch: z.object({
    launchWallet: LaunchpadSecuritySchemas.solanaPublicKey,
    tipWallet: LaunchpadSecuritySchemas.solanaPublicKey.optional(),
    tipLamports: LaunchpadSecuritySchemas.lamportsAmount.optional(),
  }),
  
  /** Request metadata */
  meta: z.object({
    timestamp: z.number()
      .int("Timestamp must be integer")
      .min(Date.now() - 300000, "Timestamp too old") // 5 min max age
      .max(Date.now() + 60000, "Timestamp in future"), // 1 min max future
    nonce: z.string()
      .min(8, "Nonce too short")
      .max(64, "Nonce too long")
      .regex(/^[a-zA-Z0-9]+$/, "Invalid nonce format"),
  }).optional(),
}).strict(); // Reject unknown fields

export type SubmitRequest = z.infer<typeof SubmitRequestSchema>;

/**
 * Standard Launchpad API response format
 */
export const LaunchpadResponseSchema = z.object({
  success: z.boolean(),
  response: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
  meta: z.object({
    requestId: z.string(),
    timestamp: z.string(),
    endpoint: z.string().optional(),
    rateLimit: z.object({
      limit: z.number(),
      remaining: z.number(),
      reset: z.number(),
    }).optional(),
  }),
});

export type LaunchpadResponse = z.infer<typeof LaunchpadResponseSchema>;

/**
 * Error codes for Launchpad
 */
export const LaunchpadErrorCodes = {
  // Feature flags
  FEATURE_DISABLED: "FEATURE_DISABLED",
  FEATURE_UNAVAILABLE: "FEATURE_UNAVAILABLE",
  
  // Authentication (PR1)  
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_INVALID: "AUTH_INVALID", 
  AUTH_EXPIRED: "AUTH_EXPIRED",
  
  // Rate limiting
  RATE_LIMITED: "RATE_LIMITED",
  REQUEST_TOO_LARGE: "REQUEST_TOO_LARGE",
  
  // Validation
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_TOKEN_DATA: "INVALID_TOKEN_DATA",
  INVALID_LAUNCH_CONFIG: "INVALID_LAUNCH_CONFIG",
  
  // Security
  SECURITY_VIOLATION: "SECURITY_VIOLATION",
  BLOCKED_URL: "BLOCKED_URL",
  BLOCKED_IP: "BLOCKED_IP",
  
  // System
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
} as const;

/**
 * Helper to create standardized error response
 */
export function createErrorResponse(
  code: keyof typeof LaunchpadErrorCodes,
  message: string,
  requestId: string,
  details?: any,
  statusCode = 400
): { response: LaunchpadResponse; status: number } {
  return {
    response: {
      success: false,
      error: {
        code: LaunchpadErrorCodes[code],
        message,
        details,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    },
    status: statusCode,
  };
}

/**
 * Helper to create standardized success response
 */
export function createSuccessResponse(
  data: any,
  requestId: string,
  endpoint?: string
): LaunchpadResponse {
  return {
    success: true,
    response: data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      endpoint,
    },
  };
}