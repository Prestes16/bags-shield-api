/**
 * Hardened /api/scan endpoint with strict validation and anti-forgery
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { LaunchpadValidator } from "@/lib/security/validate";
import { applyCorsHeaders, applyNoStore, applySecurityHeaders, getOrGenerateRequestId, SafeLogger } from "@/lib/security";
import { safeJsonParse } from "@/lib/security/jsonParseSafe";

// Rate limiting - simple in-memory store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20; // 20 requests per minute per IP

async function applyRateLimit(req: NextRequest): Promise<{ success: true } | NextResponse> {
  const requestId = getOrGenerateRequestId(req.headers);
  
  // Extract client IP
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                   req.headers.get('x-real-ip') ||
                   req.headers.get('cf-connecting-ip') ||
                   'unknown';

  const now = Date.now();
  const key = `scan:${clientIP}`;
  
  // Clean up expired entries occasionally
  if (Math.random() < 0.1) {
    for (const [k, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
  }

  const entry = rateLimitStore.get(key);
  
  if (entry) {
    if (entry.resetTime > now) {
      // Within window
      if (entry.count >= RATE_LIMIT_MAX) {
        const resetInSeconds = Math.ceil((entry.resetTime - now) / 1000);
        
        SafeLogger.warn("Rate limit exceeded", { 
          requestId, 
          clientIP: clientIP.substring(0, 8) + "...", 
          count: entry.count,
          resetIn: resetInSeconds 
        });
        
        const response = NextResponse.json(
          {
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "Too many requests. Please try again later.",
              retryAfter: resetInSeconds
            },
            meta: { requestId }
          },
          { status: 429 }
        );
        
        response.headers.set("retry-after", resetInSeconds.toString());
        response.headers.set("x-request-id", requestId);
        applyCorsHeaders(req, response);
        applyNoStore(response);
        applySecurityHeaders(response);
        
        return response;
      }
      
      entry.count++;
    } else {
      // Reset window
      entry.count = 1;
      entry.resetTime = now + RATE_LIMIT_WINDOW;
    }
  } else {
    // New entry
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
  }

  return { success: true };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Strict request schema - fail-closed
const ScanRequestSchema = z.object({
  mint: z.string()
    .trim()
    .min(32, "mint must be at least 32 characters")
    .max(44, "mint must be at most 44 characters")
    .refine(LaunchpadValidator.validateMint, "invalid mint address"),
  amount: z.number()
    .finite()
    .min(0, "amount must be >= 0")
    .max(1_000_000_000, "amount too large")
    .optional(),
  wallet: z.string()
    .trim()
    .refine(LaunchpadValidator.validateWallet, "invalid wallet address")
    .optional(),
  slippage: z.number()
    .min(0, "slippage must be >= 0")
    .max(100, "slippage must be <= 100")
    .optional(),
  locale: z.enum(["en", "pt", "es", "fr"]).optional(),
  referrer: z.string()
    .trim()
    .max(128, "referrer too long")
    .optional()
}).strict(); // Reject unknown keys

const MAX_BODY_SIZE = 16 * 1024; // 16KB
const API_BASE = process.env.BAGS_SHIELD_API_BASE?.trim() || "https://bags-shield-api.vercel.app";

async function validateRequest(req: NextRequest): Promise<{ 
  data: z.infer<typeof ScanRequestSchema>;
  requestId: string;
} | NextResponse> {
  const requestId = getOrGenerateRequestId(req.headers);

  // Body size limit check
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
    SafeLogger.warn("Request body too large", { requestId, contentLength });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BODY_TOO_LARGE", 
          message: "Request body exceeds size limit",
          issues: [{ path: "body", message: `Maximum ${MAX_BODY_SIZE} bytes allowed` }]
        },
        meta: { requestId }
      },
      { status: 413 }
    );
  }

  // Content-Type enforcement for POST
  if (req.method === "POST") {
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      SafeLogger.warn("Invalid content-type", { requestId, contentType });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CONTENT_TYPE",
            message: "Content-Type must be application/json",
            issues: [{ path: "headers", message: "Expected application/json" }]
          },
          meta: { requestId }
        },
        { status: 400 }
      );
    }
  }

  let rawData: any;

  if (req.method === "GET") {
    // Parse GET params
    const { searchParams } = new URL(req.url);
    rawData = {
      mint: searchParams.get("mint") || "",
      amount: searchParams.get("amount") ? parseFloat(searchParams.get("amount")!) : undefined,
      wallet: searchParams.get("wallet") || undefined,
      slippage: searchParams.get("slippage") ? parseFloat(searchParams.get("slippage")!) : undefined,
      locale: searchParams.get("locale") || undefined,
      referrer: searchParams.get("referrer") || undefined
    };
  } else {
    // Parse POST body safely
    const parseResult = await safeJsonParse(await req.text());
    if (!parseResult.success) {
      SafeLogger.warn("JSON parse failed", { requestId, error: parseResult.error });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "Invalid JSON in request body",
            issues: [{ path: "body", message: parseResult.error }]
          },
          meta: { requestId }
        },
        { status: 400 }
      );
    }
    rawData = parseResult.data;

    // Remove any client-provided integrity fields (anti-forgery)
    if (rawData && typeof rawData === 'object') {
      delete rawData.integrity;
      delete rawData.signature;
      delete rawData.payloadHash;
      delete rawData.evaluatedAt;
      delete rawData.deploymentId;
    }
  }

  // Strict validation with Zod
  const validation = ScanRequestSchema.safeParse(rawData);
  if (!validation.success) {
    const issues = validation.error.issues.map(issue => ({
      path: issue.path.join('.') || 'root',
      message: issue.message
    }));
    
    SafeLogger.warn("Request validation failed", { requestId, issues });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          issues
        },
        meta: { requestId }
      },
      { status: 400 }
    );
  }

  return { data: validation.data, requestId };
}

export async function POST(req: NextRequest) {
  // Apply rate limiting first
  const rateLimitResult = await applyRateLimit(req);
  if ('status' in rateLimitResult) return rateLimitResult;

  const validation = await validateRequest(req);
  if ('status' in validation) return validation; // Error response

  return await processScanRequest(validation.data, validation.requestId, req);
}

export async function GET(req: NextRequest) {
  // Apply rate limiting first 
  const rateLimitResult = await applyRateLimit(req);
  if ('status' in rateLimitResult) return rateLimitResult;

  const validation = await validateRequest(req);
  if ('status' in validation) return validation; // Error response
  
  return await processScanRequest(validation.data, validation.requestId, req);
}

async function processScanRequest(data: z.infer<typeof ScanRequestSchema>, requestId: string, req: NextRequest) {
  // Forward to upstream with strict timeout and budget control
  const controller = new AbortController();
  const UPSTREAM_TIMEOUT = 12_000; // 12s timeout (stricter)
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);

  try {
    const upstreamUrl = `${API_BASE}/api/scan`;
    
    SafeLogger.info("Forwarding scan request", { 
      requestId, 
      mint: data.mint.substring(0, 8) + "...", // Partial mint for logging
      upstreamUrl 
    });

    const response = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json",
        "x-request-id": requestId,
        "cache-control": "no-store"
      },
      body: JSON.stringify(data),
      signal: controller.signal
    });

    const responseText = await response.text();
    let responseData: any;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      SafeLogger.error("Invalid JSON from upstream", { requestId, status: response.status });
      return createErrorResponse(requestId, "UPSTREAM_INVALID_JSON", "Invalid response from upstream", 502);
    }

    // Add integrity signature to response (TASK 3 will implement this)
    const integrityData = await generateIntegrityData(responseData, requestId);
    if (responseData && typeof responseData === 'object') {
      responseData.integrity = integrityData;
    }

    const finalResponse = NextResponse.json(responseData, { status: response.status });
    applyCorsHeaders(req, finalResponse);
    applyNoStore(finalResponse);
    applySecurityHeaders(finalResponse);
    finalResponse.headers.set("x-request-id", requestId);

    return finalResponse;

  } catch (error: any) {
    const isTimeout = error?.name === "AbortError";
    const message = isTimeout ? "Upstream request timeout" : "Upstream request failed";
    const code = isTimeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR";
    
    SafeLogger.error("Upstream request failed", { 
      requestId, 
      error: error?.message, 
      isTimeout 
    });
    
    return createErrorResponse(requestId, code, message, 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function generateIntegrityData(payload: any, requestId: string) {
  const secret = process.env.SCAN_HMAC_SECRET;
  if (!secret) {
    // Fail-closed in production, but allow dev to continue with warning
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      SafeLogger.warn("SCAN_HMAC_SECRET not set - using development fallback", { requestId });
    } else {
      SafeLogger.error("SCAN_HMAC_SECRET not configured in production", { requestId });
      throw new Error("SCAN_HMAC_SECRET environment variable is required");
    }
  }

  // Extract core payload fields (excluding volatile fields)
  const corePayload = extractCorePayload(payload);
  
  // Create deterministic hash of core payload
  const payloadString = JSON.stringify(corePayload, Object.keys(corePayload).sort());
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payloadString);
  
  const payloadHash = await crypto.subtle.digest('SHA-256', payloadBytes);
  const payloadHashHex = Array.from(new Uint8Array(payloadHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Generate HMAC signature
  const signatureKey = secret || `dev-fallback-${requestId.substring(0, 8)}`;
  const keyBytes = encoder.encode(signatureKey);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureData = encoder.encode(`${payloadHashHex}.${requestId}`);
  const signature = await crypto.subtle.sign('HMAC', key, signatureData);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    payloadHash: payloadHashHex,
    signature: signatureHex,
    evaluatedAt: new Date().toISOString(),
    requestId,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || "local"
  };
}

/**
 * Extract core payload fields for hashing (exclude volatile/metadata fields)
 */
function extractCorePayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return {};
  
  // Extract only core scan result fields, exclude metadata
  const { 
    mint, 
    score, 
    grade, 
    summary, 
    badges, 
    findings,
    // Exclude volatile fields
    success,
    meta,
    integrity,
    timestamp,
    requestId,
    evaluatedAt,
    ...rest 
  } = payload;

  return {
    mint,
    score,
    grade, 
    summary,
    badges,
    findings,
    // Include any other non-volatile fields
    ...Object.fromEntries(
      Object.entries(rest || {}).filter(([key]) => 
        !key.startsWith('_') && // Exclude private fields
        !['timestamp', 'evaluatedAt', 'requestId'].includes(key)
      )
    )
  };
}

function createErrorResponse(requestId: string, code: string, message: string, status: number) {
  const response = NextResponse.json(
    {
      success: false,
      error: { code, message },
      meta: { requestId }
    },
    { status }
  );
  
  // Apply security headers
  response.headers.set("cache-control", "no-store, max-age=0");
  response.headers.set("pragma", "no-cache");
  response.headers.set("x-request-id", requestId);
  
  return response;
}
