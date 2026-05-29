/**
 * GET /api/launchpad/partner-config/status
 *
 * Read-only diagnostic for the future Bags partner-config path. This endpoint
 * never calls Bags write endpoints, never returns a transaction, and never
 * enables public Launchpad writes.
 */

import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import {
  getOrGenerateRequestId,
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
  SafeLogger,
} from "@/lib/security";
import { handlePreflight } from "@/lib/security/cors";
import { BAGS_SHIELD_FEE_SHARE_WALLET } from "@/lib/launchpad/fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/launchpad/partner-config/status";
const PARTNER_CONFIG_ENV = "LAUNCHPAD_PARTNER_CONFIG";
const PARTNER_WALLET_ENV = "LAUNCHPAD_PARTNER_WALLET";

function jsonResponse(req: NextRequest, requestId: string, body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set("X-Request-Id", requestId);
  return res;
}

function parsePublicKey(value: string | undefined, field: string) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new PublicKey(trimmed).toBase58();
  } catch {
    throw new Error(`${field} must be a valid Solana public key`);
  }
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ["GET"]);
}

export async function GET(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);

  try {
    const officialPartnerWallet = new PublicKey(BAGS_SHIELD_FEE_SHARE_WALLET).toBase58();
    const configuredPartnerWallet = parsePublicKey(process.env[PARTNER_WALLET_ENV], PARTNER_WALLET_ENV);
    const partnerConfig = parsePublicKey(process.env[PARTNER_CONFIG_ENV], PARTNER_CONFIG_ENV);

    if (configuredPartnerWallet && configuredPartnerWallet !== officialPartnerWallet) {
      throw new Error(`${PARTNER_WALLET_ENV} must be ${officialPartnerWallet}`);
    }

    const configured = Boolean(partnerConfig);
    const reason = configured
      ? "Partner config is configured but public launches remain paused until the final safe launch flow is validated."
      : "Partner config is not configured yet. Public launches remain paused.";

    SafeLogger.info("Launchpad partner-config diagnostic completed", {
      requestId,
      endpoint: ROUTE,
      configured,
      hasPartnerWalletOverride: Boolean(configuredPartnerWallet),
    });

    return jsonResponse(req, requestId, {
      success: true,
      response: {
        partnerWallet: officialPartnerWallet,
        partnerConfig,
        configured,
        source: configured ? "env" : "missing",
        publicLaunchSafe: false,
        reason,
        nextAction: "Create partner config outside the public user flow, then set LAUNCHPAD_PARTNER_CONFIG.",
      },
      meta: { requestId },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Partner config diagnostic failed";
    SafeLogger.error("Launchpad partner-config diagnostic failed", error, {
      requestId,
      endpoint: ROUTE,
    });

    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: "LAUNCHPAD_PARTNER_CONFIG_INVALID",
          message,
        },
        meta: { requestId },
      },
      { status: 503 },
    );
  }
}
