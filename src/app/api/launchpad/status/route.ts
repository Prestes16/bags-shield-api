/**
 * Launchpad Status Endpoint - Feature Discovery and Health Check
 * Public endpoint showing available features and system status
 */

import { NextRequest, NextResponse } from "next/server";
import { getOrGenerateRequestId, applyCorsHeaders, applyNoStore, applySecurityHeaders, SafeLogger } from "@/lib/security";
import { createSuccessResponse } from "@/lib/launchpad/security-schemas";
import { getLaunchpadFeatures, getFeatureSummary } from "@/lib/launchpad/feature-flags";
import { isLaunchpadEnabled, getLaunchpadMode } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/launchpad/status
 * Public status and feature discovery endpoint
 */
export async function GET(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);
  const endpoint = "/api/launchpad/status";
  
  SafeLogger.debug("Launchpad status request", { requestId, endpoint });

  try {
    const features = getLaunchpadFeatures();
    const summary = getFeatureSummary();
    
    const statusData = {
      status: "operational",
      version: "PR0-Foundation",
      launchpad: {
        enabled: isLaunchpadEnabled(),
        mode: getLaunchpadMode(),
        features: summary,
      },
      endpoints: {
        submit: {
          path: "/api/launchpad/submit",
          methods: ["POST"],
          status: features.enabled ? "not_implemented" : "disabled",
          implementationStatus: "PR0 - Security foundation complete",
        },
        auth: {
          path: "/api/launchpad/auth/*",
          status: "upcoming",
          implementationStatus: "PR1 - SIWS authentication",
        },
        verify: {
          path: "/api/launchpad/verify/*", 
          status: "upcoming",
          implementationStatus: "PR3 - On-chain verification",
        },
      },
      roadmap: {
        pr0: { 
          status: "completed",
          description: "Security foundation, schemas, feature flags",
          features: ["sanitization", "validation", "feature-flags", "error-handling"],
        },
        pr1: {
          status: "planned", 
          description: "SIWS authentication with signature verification",
          features: ["siws-auth", "session-management", "jwt-tokens"],
        },
        pr2: {
          status: "planned",
          description: "ProofPack schema validation", 
          features: ["proof-pack-validation", "metadata-verification"],
        },
        pr3: {
          status: "planned",
          description: "On-chain verification and scoring",
          features: ["on-chain-verification", "score-engine", "badge-system"],
        },
        pr4: {
          status: "planned", 
          description: "Signed attestation with snapshots",
          features: ["signed-attestation", "blockchain-snapshots"],
        },
        pr5: {
          status: "planned",
          description: "KV persistence, rate limiting, idempotency", 
          features: ["kv-storage", "rate-limiting", "idempotency-keys"],
        },
        pr6: {
          status: "planned",
          description: "Monitoring and revocation webhooks",
          features: ["webhook-integration", "monitoring", "revocation"],
        },
      },
      security: {
        featureFlags: features.enabled,
        inputSanitization: true,
        schemaValidation: true,
        requestSizeLimit: true,
        rateLimitReady: true,
        corsEnabled: true,
        securityHeaders: true,
        antiSsrf: true,
      },
      systemInfo: {
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
        version: "1.0.0-PR0",
      },
    };

    const response = createSuccessResponse(statusData, requestId, endpoint);
    
    let res = NextResponse.json(response, { 
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60", // Cache for 1 minute
        "X-Launchpad-Version": "PR0-Foundation",
        "X-Implementation-Status": "Security-Foundation-Complete",
      }
    });
    
    res = applyCorsHeaders(req, res) as NextResponse;
    res = applySecurityHeaders(res) as NextResponse;
    res.headers.set("X-Request-Id", requestId);
    
    SafeLogger.debug("Status request completed", { 
      requestId, 
      enabled: features.enabled,
      availableFeatures: summary.availableFeatures.length,
    });
    
    return res;

  } catch (error) {
    SafeLogger.error("Error in status endpoint", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Fallback status response
    const fallbackData = {
      status: "degraded",
      message: "Status endpoint encountered an error",
      launchpad: {
        enabled: false,
        mode: "stub",
      },
    };
    
    const response = createSuccessResponse(fallbackData, requestId, endpoint);
    
    let res = NextResponse.json(response, { status: 200 });
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