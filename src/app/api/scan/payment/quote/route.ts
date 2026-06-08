/**
 * POST /api/scan/payment/quote
 *
 * Returns a single-scan payment quote for the authenticated account. One quote
 * authorizes exactly one extra scan after the daily free limit is reached.
 * Requires a Bags Shield JWT. Price/treasury come from server config - never
 * from the client.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getOrGenerateRequestId,
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
  safeJsonParse,
  SafeLogger,
} from "@/lib/security";
import { handlePreflight } from "@/lib/security/cors";
import { LaunchpadValidator } from "@/lib/security/validate";
import { resolveScanUserId, scanPaywallEnabled, createPaymentIntent } from "@/lib/scan/paywall";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/scan/payment/quote";

function json(req: NextRequest, requestId: string, body: unknown, status = 200) {
  const res = NextResponse.json(body, { status });
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set("x-request-id", requestId);
  return res;
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ["POST"]);
}

export async function POST(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);

  if (!scanPaywallEnabled()) {
    return json(req, requestId, {
      success: false,
      error: { code: "PAYWALL_DISABLED", message: "Scanner paywall is disabled." },
      meta: { requestId },
    }, 400);
  }

  const userId = await resolveScanUserId(req);
  if (!userId) {
    return json(req, requestId, {
      success: false,
      error: { code: "SCAN_AUTH_REQUIRED", message: "Sign in to your Bags Shield account." },
      meta: { requestId },
    }, 401);
  }

  const parsed = safeJsonParse<{ mint?: unknown }>(await req.text());
  const mint = String(parsed.data?.mint ?? "").trim();
  if (!mint || !LaunchpadValidator.validateMint(mint)) {
    return json(req, requestId, {
      success: false,
      error: { code: "INVALID_MINT", message: "A valid token mint is required." },
      meta: { requestId },
    }, 400);
  }

  try {
    const quote = await createPaymentIntent(userId, mint);
    return json(req, requestId, {
      success: true,
      response: {
        requestId: quote.reference,
        reference: quote.reference,
        priceLamports: quote.priceLamports,
        treasuryWallet: quote.treasuryWallet,
        expiresAt: quote.expiresAt,
      },
      meta: { requestId },
    });
  } catch {
    SafeLogger.warn("Scan payment quote failed", { requestId, endpoint: ROUTE });
    return json(req, requestId, {
      success: false,
      error: { code: "QUOTE_FAILED", message: "Could not create payment quote." },
      meta: { requestId },
    }, 503);
  }
}
