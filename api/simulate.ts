import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, guardMethod, noStore, ensureRequestId } from "../lib/cors";
import { badRequest, ok } from "../lib/http";
import { getSimMode } from "../lib/env";
import { rateLimitMiddleware } from "../lib/rate";

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
  let requestId = "unknown";
  
  try {
    // Set CORS and cache headers first
    setCors(res, req);
    noStore(res);

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (!guardMethod(req, res, ["POST"])) return;

    // Ensure request ID is set before rate limiting
    requestId = ensureRequestId(res);

    // Rate limiting (only active if env vars are set)
    if (!rateLimitMiddleware(req, res)) {
      return;
    }
    
    const body = (req.body ?? {}) as SimulateRequestBody;
    const mint = body.mint;

    if (!isBase58ish(mint)) {
      badRequest(res, "mint field is missing or invalid.", requestId);
      return;
    }

    const score = 68;
    const grade =
      score >= 80 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "E";
    const mode = getSimMode();

    ok(
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
    requestId = ensureRequestId(res);
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
