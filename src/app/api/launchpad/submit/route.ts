/**
 * PR0: Launchpad Submit Endpoint - Security Hardened Foundation
 * 
 * Returns 501 Not Implemented when LAUNCHPAD_ENABLED=false (default)
 * Includes comprehensive input sanitization and validation
 */

import { NextRequest, NextResponse } from "next/server";
import { checkLaunchpadEnabled } from "@/lib/launchpad/middleware";
import { getOrGenerateRequestId, applyCorsHeaders, applyNoStore, applySecurityHeaders, SafeLogger } from "@/lib/security";
import { SubmitRequestSchema, createErrorResponse, createSuccessResponse, LaunchpadErrorCodes } from "@/lib/launchpad/security-schemas";
import { validateRequestSize, generateRateLimitKey } from "@/lib/launchpad/sanitization";
import { safeJsonParse as jsonParseSafe } from "@/lib/security/jsonParseSafe";
import { isLaunchpadEnabled } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/launchpad/submit
 * Submit token launch request (security hardened)
 */
export async function POST(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);
  const endpoint = "/api/launchpad/submit";
  
  SafeLogger.info("Launchpad submit request received", { 
    requestId, 
    endpoint,
    userAgent: req.headers.get("user-agent"),
    origin: req.headers.get("origin"),
  });

  try {
    // Security Check 1: Feature flag (fail-closed by default)
    const featureCheck = checkLaunchpadEnabled(req, endpoint);
    if (featureCheck) {
      SafeLogger.warn("Launchpad submit blocked - feature disabled", { requestId });
      return featureCheck;
    }

    // Security Check 2: Request size validation (prevent DoS)
    if (!validateRequestSize(req, 10240)) { // 10KB max
      SafeLogger.warn("Request too large", { requestId, endpoint });
      const errorResponse = createErrorResponse(
        "REQUEST_TOO_LARGE", 
        "Request payload exceeds maximum allowed size",
        requestId,
        { maxBytes: 10240 },
        413
      );
      
      let res = NextResponse.json(errorResponse.response, { status: errorResponse.status });
      res = applyCorsHeaders(req, res) as NextResponse;
      res = applyNoStore(res) as NextResponse;  
      res = applySecurityHeaders(res) as NextResponse;
      res.headers.set("X-Request-Id", requestId);
      return res;
    }

    // Security Check 3: Rate limiting key generation
    const rateLimitKey = generateRateLimitKey(req, "submit");
    SafeLogger.debug("Rate limit key generated", { requestId, rateLimitKey });

    // Security Check 4: Parse and validate JSON safely
    const parseResult = await (jsonParseSafe as any)(await req.text());
    if (!parseResult.success) {
      SafeLogger.warn("Invalid JSON in request", { 
        requestId, 
        error: parseResult.error 
      });
      
      const errorResponse = createErrorResponse(
        "INVALID_INPUT",
        "Invalid JSON format in request body", 
        requestId,
        { parseError: parseResult.error },
        400
      );
      
      let res = NextResponse.json(errorResponse.response, { status: errorResponse.status });
      res = applyCorsHeaders(req, res) as NextResponse;
      res = applyNoStore(res) as NextResponse;
      res = applySecurityHeaders(res) as NextResponse;  
      res.headers.set("X-Request-Id", requestId);
      return res;
    }

    // Security Check 5: Schema validation with sanitization
    const validationResult = SubmitRequestSchema.safeParse(parseResult.data);
    if (!validationResult.success) {
      SafeLogger.warn("Schema validation failed", {
        requestId,
        errors: validationResult.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      });
      
      const errorResponse = createErrorResponse(
        "INVALID_INPUT",
        "Request validation failed", 
        requestId,
        { 
          validationErrors: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          }))
        },
        400
      );
      
      let res = NextResponse.json(errorResponse.response, { status: errorResponse.status });
      res = applyCorsHeaders(req, res) as NextResponse;
      res = applyNoStore(res) as NextResponse;
      res = applySecurityHeaders(res) as NextResponse;
      res.headers.set("X-Request-Id", requestId);
      return res;
    }

    const sanitizedData = validationResult.data;
    
    SafeLogger.info("Submit request validated successfully", {
      requestId,
      tokenName: sanitizedData.token.name,
      tokenSymbol: sanitizedData.token.symbol,
      launchWallet: sanitizedData.launch.launchWallet,
    });

    // PR0: Return "Not Implemented" with detailed roadmap
    // Future PRs will replace this with actual implementation
    const roadmapResponse = {
      status: "not_implemented",
      message: "Launchpad submit endpoint is in development",
      roadmap: {
        pr1: "SIWS authentication with signature verification",
        pr2: "ProofPack schema validation", 
        pr3: "On-chain verification and scoring engine",
        pr4: "Signed attestation with blockchain snapshot",
        pr5: "KV persistence with rate limiting and idempotency",
        pr6: "Monitoring and revocation webhook integration",
      },
      nextSteps: [
        "Enable LAUNCHPAD_ENABLED=true in environment",
        "Wait for PR1-6 implementation",
        "Authentication will be required for actual submission",
      ],
      submittedData: {
        token: sanitizedData.token,
        launch: {
          launchWallet: sanitizedData.launch.launchWallet,
          // Hide sensitive data in logs
          tipWallet: sanitizedData.launch.tipWallet ? "***" : null,
          tipLamports: sanitizedData.launch.tipLamports || null,
        },
      },
    };

    const response = createSuccessResponse(roadmapResponse, requestId, endpoint);
    
    let res = NextResponse.json(response, { 
      status: 501, // Not Implemented
      headers: {
        "X-Implementation-Status": "PR0-Foundation",
        "X-Next-PR": "PR1-SIWS-Auth",
      }
    });
    
    res = applyCorsHeaders(req, res) as NextResponse;
    res = applyNoStore(res) as NextResponse;
    res = applySecurityHeaders(res) as NextResponse;
    res.headers.set("X-Request-Id", requestId);
    
    SafeLogger.info("Submit request completed (not implemented)", { 
      requestId, 
      status: 501,
      tokenSymbol: sanitizedData.token.symbol,
    });
    
    return res;

  } catch (error) {
    SafeLogger.error("Unexpected error in submit endpoint", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    const errorResponse = createErrorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred",
      requestId,
      undefined,
      500
    );
    
    let res = NextResponse.json(errorResponse.response, { status: errorResponse.status });
    res = applyCorsHeaders(req, res) as NextResponse;
    res = applyNoStore(res) as NextResponse;
    res = applySecurityHeaders(res) as NextResponse;
    res.headers.set("X-Request-Id", requestId);
    return res;
  }
}

/**
 * OPTIONS: CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);
  
  let res = new NextResponse(null, { status: 204 });
  res = applyCorsHeaders(req, res) as NextResponse;
  res = applySecurityHeaders(res) as NextResponse;
  res.headers.set("X-Request-Id", requestId);
  
  return res;
}

/**
 * Other methods: Not allowed
 */
export async function GET(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);
  
  const errorResponse = createErrorResponse(
    "INVALID_INPUT",
    "GET method not allowed. Use POST to submit launch requests.",
    requestId,
    { allowedMethods: ["POST", "OPTIONS"] },
    405
  );
  
  let res = NextResponse.json(errorResponse.response, { status: errorResponse.status });
  res = applyCorsHeaders(req, res) as NextResponse;
  res = applyNoStore(res) as NextResponse;
  res = applySecurityHeaders(res) as NextResponse;
  res.headers.set("X-Request-Id", requestId);
  res.headers.set("Allow", "POST, OPTIONS");
  
  return res;
}