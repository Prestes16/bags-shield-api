/**
 * POST /api/launchpad/partner-config/create-tx
 *
 * Admin-only diagnostic route for generating the Bags partner-config creation
 * transaction. This endpoint never signs, never broadcasts, and is not used by
 * the public App2 Launchpad flow.
 */

import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import {
  getOrGenerateRequestId,
  safeJsonParse,
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
  SafeLogger,
} from "@/lib/security";
import { handlePreflight } from "@/lib/security/cors";
import {
  createPartnerConfigCreationTx,
  type BagsPartnerConfigCreationTxResponse,
} from "@/lib/launchpad/bags-client";
import { BAGS_SHIELD_FEE_SHARE_WALLET } from "@/lib/launchpad/fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/launchpad/partner-config/create-tx";
const ADMIN_SECRET_ENV = "LAUNCHPAD_ADMIN_SECRET";
const ADMIN_HEADER = "x-admin-secret";

interface PartnerConfigCreateTxBody {
  partnerWallet?: unknown;
}

function jsonResponse(req: NextRequest, requestId: string, body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set("X-Request-Id", requestId);
  return res;
}

function secretEquals(value: string, expected: string) {
  const valueBytes = Buffer.from(value);
  const expectedBytes = Buffer.from(expected);
  return valueBytes.length === expectedBytes.length && timingSafeEqual(valueBytes, expectedBytes);
}

function parsePublicKey(value: string, field: string) {
  try {
    return new PublicKey(value.trim()).toBase58();
  } catch {
    throw new Error(`${field} must be a valid Solana public key`);
  }
}

function pickTransaction(response: BagsPartnerConfigCreationTxResponse) {
  if (typeof response === "string" && response.trim()) return response.trim();
  if (!response || typeof response !== "object") return null;

  const candidates = [
    response.transaction,
    response.tx,
    response.serializedTransaction,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

function getUpstreamStatus(details?: Record<string, unknown>) {
  const status = details?.status;
  return typeof status === "number" ? status : undefined;
}

function getUpstreamString(details: Record<string, unknown> | undefined, key: string) {
  const value = details?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ["POST"]);
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = getOrGenerateRequestId(req.headers);
  const adminSecret = process.env[ADMIN_SECRET_ENV]?.trim();

  if (!adminSecret) {
    SafeLogger.error("Launchpad partner-config admin route is not configured", undefined, {
      requestId,
      endpoint: ROUTE,
    });
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: "ADMIN_NOT_CONFIGURED",
          message: "Launchpad admin secret is not configured",
        },
        meta: { requestId },
      },
      { status: 503 },
    );
  }

  const providedSecret = req.headers.get(ADMIN_HEADER)?.trim();
  if (!providedSecret) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: "ADMIN_REQUIRED",
          message: "Admin authorization is required",
        },
        meta: { requestId },
      },
      { status: 401 },
    );
  }

  if (!secretEquals(providedSecret, adminSecret)) {
    SafeLogger.warn("Launchpad partner-config admin secret rejected", {
      requestId,
      endpoint: ROUTE,
    });
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: "ADMIN_REQUIRED",
          message: "Admin authorization is required",
        },
        meta: { requestId },
      },
      { status: 403 },
    );
  }

  let body: PartnerConfigCreateTxBody = {};
  try {
    const bodyText = await req.text();
    if (bodyText.trim()) {
      const contentType = req.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return jsonResponse(
          req,
          requestId,
          {
            success: false,
            error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json" },
            issues: [{ path: "headers.content-type", message: "Expected application/json" }],
            meta: { requestId },
          },
          { status: 415 },
        );
      }

      const parseResult = safeJsonParse<PartnerConfigCreateTxBody>(bodyText);
      if (!parseResult.success) {
        return jsonResponse(
          req,
          requestId,
          {
            success: false,
            error: { code: "BAD_REQUEST", message: parseResult.error || "Invalid JSON" },
            issues: parseResult.issues || [],
            meta: { requestId },
          },
          { status: 400 },
        );
      }

      body = parseResult.data && typeof parseResult.data === "object" ? parseResult.data : {};
    }
  } catch (error) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "BAD_REQUEST", message: "Failed to read request body" },
        issues: [{ path: "<root>", message: error instanceof Error ? error.message : "Unknown error" }],
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  const officialPartnerWallet = new PublicKey(BAGS_SHIELD_FEE_SHARE_WALLET).toBase58();
  if (body.partnerWallet !== undefined) {
    if (typeof body.partnerWallet !== "string" || !body.partnerWallet.trim()) {
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: { code: "VALIDATION_FAILED", message: "partnerWallet must be a valid Solana public key" },
          issues: [{ path: "partnerWallet", message: "Expected Solana public key string" }],
          meta: { requestId },
        },
        { status: 400 },
      );
    }

    let requestedPartnerWallet: string;
    try {
      requestedPartnerWallet = parsePublicKey(body.partnerWallet, "partnerWallet");
    } catch (error) {
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message: error instanceof Error ? error.message : "partnerWallet must be valid",
          },
          issues: [{ path: "partnerWallet", message: "Expected valid Solana public key" }],
          meta: { requestId },
        },
        { status: 400 },
      );
    }

    if (requestedPartnerWallet !== officialPartnerWallet) {
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "LAUNCHPAD_PARTNER_WALLET_MISMATCH",
            message: `partnerWallet must be ${officialPartnerWallet}`,
          },
          meta: { requestId },
        },
        { status: 400 },
      );
    }
  }

  SafeLogger.warn("Launchpad admin partner-config creation transaction requested", {
    requestId,
    endpoint: ROUTE,
    partnerWallet: officialPartnerWallet,
    signed: false,
    sent: false,
  });

  const bagsResult = await createPartnerConfigCreationTx(officialPartnerWallet);
  if ("error" in bagsResult) {
    const upstreamStatus = getUpstreamStatus(bagsResult.error.details);
    const upstreamCode = getUpstreamString(bagsResult.error.details, "upstreamCode");
    const upstreamMessage = getUpstreamString(bagsResult.error.details, "upstreamMessage");

    SafeLogger.error("Bags partner-config creation transaction request failed", undefined, {
      requestId,
      endpoint: ROUTE,
      errorCode: bagsResult.error.code,
      upstreamStatus,
      upstreamCode,
    });

    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: "BAGS_PARTNER_CONFIG_CREATE_TX_FAILED",
          message: bagsResult.error.message,
          upstreamStatus,
          upstreamCode,
          upstreamMessage,
        },
        meta: {
          requestId,
          upstream: "bags",
          upstreamStatus,
          upstreamCode,
          elapsedMs: Date.now() - startTime,
        },
      },
      { status: bagsResult.error.code === "BAGS_NOT_CONFIGURED" ? 503 : upstreamStatus || 502 },
    );
  }

  const transaction = pickTransaction(bagsResult.response);
  const upstreamResponse =
    bagsResult.response && typeof bagsResult.response === "object" && !Array.isArray(bagsResult.response)
      ? bagsResult.response
      : {};

  SafeLogger.info("Bags partner-config creation transaction generated for admin inspection", {
    requestId,
    endpoint: ROUTE,
    transactionPresent: Boolean(transaction),
    signed: false,
    sent: false,
  });

  return jsonResponse(req, requestId, {
    success: true,
    response: {
      partnerWallet: officialPartnerWallet,
      ...upstreamResponse,
      transaction,
      transactionPresent: Boolean(transaction),
      signed: false,
      sent: false,
      publicLaunchSafe: false,
      nextAction:
        "Inspect and sign/send this transaction only as an admin operation outside the public user flow. After confirmed, set LAUNCHPAD_PARTNER_CONFIG.",
    },
    meta: {
      requestId,
      upstream: "bags",
      elapsedMs: Date.now() - startTime,
    },
  });
}
