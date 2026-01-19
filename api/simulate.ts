import type { VercelRequest, VercelResponse } from "@vercel/node";
// import { setCors, guardMethod, noStore, ensureRequestId } from '.js';

// Dynamic import for cors helpers
async function getCorsHelpers() {
  try {
    return await import("../lib/cors.js");
  } catch (error) {
    console.error("[simulate] Error importing cors module:", error);
    // Fallback implementations
    return {
      setCors: (res: VercelResponse) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
      },
      noStore: (res: VercelResponse) => {
        res.setHeader("Cache-Control", "no-store");
      },
      ensureRequestId: (res: VercelResponse): string => {
        const id = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
        res.setHeader("X-Request-Id", id);
        return id;
      },
      guardMethod: (req: VercelRequest, res: VercelResponse, allowed: string[]): boolean => {
        const method = req.method ?? "";
        if (!allowed.includes(method)) {
          res.status(405).json({ success: false, error: "method_not_allowed", meta: { requestId: "unknown" } });
          return false;
        }
        return true;
      },
    };
  }
}
// import { badRequest, ok } from '../lib/http.js';

// Dynamic import for http helpers
async function badRequestSafe(
  res: VercelResponse,
  message: string,
  requestId?: string,
  details?: unknown
): Promise<void> {
  try {
    const httpModule = await import("../lib/http.js");
    httpModule.badRequest(res, message, requestId, details);
  } catch (error) {
    console.error("[simulate] Error importing http module:", error);
    res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message },
      meta: { requestId: requestId || "unknown" },
    });
  }
}

async function okSafe<T>(
  res: VercelResponse,
  data: T,
  requestId?: string,
  meta?: Partial<{ requestId: string; [key: string]: unknown }>
): Promise<void> {
  try {
    const httpModule = await import("../lib/http.js");
    httpModule.ok(res, data, requestId, meta);
  } catch (error) {
    console.error("[simulate] Error importing http module:", error);
    res.status(200).json({
      success: true,
      response: data,
      meta: { requestId: requestId || "unknown", ...meta },
    });
  }
}
// import { getSimMode } from '../lib/env.js';
// import { rateLimitMiddleware } from '../lib/rate.js';

// Dynamic imports to catch module loading errors
async function getSimModeSafe(): Promise<string> {
  try {
    const envModule = await import("../lib/env.js");
    return envModule.getSimMode();
  } catch (error) {
    console.error("[simulate] Error importing env module:", error);
    return "mock";
  }
}

async function rateLimitMiddlewareSafe(
  req: VercelRequest,
  res: VercelResponse
): Promise<boolean> {
  try {
    const rateModule = await import("../lib/rate.js");
    return rateModule.rateLimitMiddleware(req, res);
  } catch (error) {
    console.error("[simulate] Error importing rate module:", error);
    return true; // Allow request if rate limiting fails
  }
}

interface SimulateRequestBody {
  mint?: string;
}

function isBase58ish(s: unknown): s is string {
  return typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    const cors = await getCorsHelpers();
    
    // Set CORS and cache headers first
    cors.setCors(res);
    cors.noStore(res);

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (!cors.guardMethod(req, res, ["POST"])) return;

    // Ensure request ID is set before rate limiting
    const requestId = cors.ensureRequestId(res);

    // Rate limiting (only active if env vars are set)
    if (!(await rateLimitMiddlewareSafe(req, res))) {
      return;
    }
    const body = (req.body ?? {}) as SimulateRequestBody;
    const mint = body.mint;

    if (!isBase58ish(mint)) {
      await badRequestSafe(res, "mint field is missing or invalid.", requestId);
      return;
    }

    const score = 68;
    const grade =
      score >= 80 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "E";
    const mode = await getSimModeSafe();

    await okSafe(
      res,
      {
        isSafe: score >= 80,
        shieldScore: score,
        grade,
        warnings: [],
        metadata: { mode, mintLength: mint.length, base: null },
      },
      requestId,
      { mode }
    );
    return;
  } catch (error) {
    const cors = await getCorsHelpers();
    const requestId = cors.ensureRequestId(res);
    const isDev = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "development";
    console.error("[simulate] Error:", error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: isDev ? (error instanceof Error ? error.message : "Internal server error") : "Internal server error",
      },
      meta: { requestId },
    });
  }
}
