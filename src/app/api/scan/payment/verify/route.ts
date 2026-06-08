/**
 * POST /api/scan/payment/verify
 *
 * Verifies a paid-scan transaction on-chain and marks the matching intent as
 * paid (single-use). Requires a Bags Shield JWT. Body: { signature, requestId }
 * (requestId is the quote reference). All ownership/amount/destination/memo and
 * anti-replay checks happen server-side in verifyScanPayment.
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
import { resolveScanUserId, scanPaywallEnabled, verifyScanPayment } from "@/lib/scan/paywall";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROUTE = "/api/scan/payment/verify";

const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;

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

  const parsed = safeJsonParse<{ signature?: unknown; requestId?: unknown; reference?: unknown }>(await req.text());
  const signature = String(parsed.data?.signature ?? "").trim();
  const reference = String(parsed.data?.reference ?? parsed.data?.requestId ?? "").trim();

  if (!SIGNATURE_RE.test(signature)) {
    return json(req, requestId, {
      success: false,
      error: { code: "INVALID_SIGNATURE", message: "A valid transaction signature is required." },
      meta: { requestId },
    }, 400);
  }
  if (!reference) {
    return json(req, requestId, {
      success: false,
      error: { code: "MISSING_REFERENCE", message: "Payment reference is required." },
      meta: { requestId },
    }, 400);
  }

  const result = await verifyScanPayment(userId, signature, reference);
  if (result.ok) {
    return json(req, requestId, {
      success: true,
      response: { verified: true },
      meta: { requestId },
    });
  }

  const failure = result as Extract<typeof result, { ok: false }>;
  SafeLogger.warn("Scan payment verify rejected", { requestId, endpoint: ROUTE, code: failure.code });
  return json(req, requestId, {
    success: false,
    error: { code: failure.code, message: failure.message },
    meta: { requestId },
  }, 400);
}
