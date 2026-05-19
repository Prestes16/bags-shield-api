import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import {
  getOrGenerateRequestId,
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
  SafeLogger,
} from "@/src/lib/security";
import { handlePreflight } from "@/src/lib/security/cors";
import { getClaimablePositions } from "@/src/lib/launchpad/bags-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/launchpad/fee-claims/positions";

function isValidPublicKey(value: string) {
  try {
    new PublicKey(value);
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
  } catch {
    return false;
  }
}

function jsonResponse(req: NextRequest, requestId: string, body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set("X-Request-Id", requestId);
  return res;
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ["GET"]);
}

export async function GET(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim() ?? "";

  if (!wallet || !isValidPublicKey(wallet)) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "INVALID_WALLET", message: "wallet query param must be a valid Solana public key" },
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  const result = await getClaimablePositions(wallet);

  if ("error" in result) {
    SafeLogger.error("Bags claimable positions request failed", undefined, {
      requestId,
      endpoint: ROUTE,
      errorCode: result.error.code,
    });

    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: result.error.code, message: result.error.message },
        meta: { requestId, upstream: "bags" },
      },
      { status: result.error.code === "BAGS_NOT_CONFIGURED" ? 503 : 502 },
    );
  }

  return jsonResponse(req, requestId, {
    success: true,
    response: {
      wallet,
      positions: Array.isArray(result.response) ? result.response : [],
    },
    meta: { requestId, upstream: "bags" },
  });
}
