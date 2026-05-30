/**
 * POST /api/launchpad/partner-config/upstream-diagnostic
 *
 * Admin-only route that probes the Bags /fee-share/partner-config/creation-tx
 * endpoint with multiple payload variants to diagnose upstream 500 errors.
 *
 * - Never signs, never broadcasts, never exposes API key or admin secret.
 * - Never returns the transaction value (only presence and length).
 * - Requires x-admin-secret identical to the create-tx route.
 */

import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getOrGenerateRequestId,
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
  SafeLogger,
} from "@/lib/security";
import { handlePreflight } from "@/lib/security/cors";
import {
  probePartnerConfigCreationTx,
  type PartnerConfigDiagnosticResult,
} from "@/lib/launchpad/bags-client";
import { BAGS_SHIELD_FEE_SHARE_WALLET } from "@/lib/launchpad/fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/launchpad/partner-config/upstream-diagnostic";
const ADMIN_SECRET_ENV = "LAUNCHPAD_ADMIN_SECRET";
const ADMIN_HEADER = "x-admin-secret";

const DIAGNOSTIC_VARIANTS: Array<{
  label: string;
  buildBody: (wallet: string) => Record<string, unknown>;
}> = [
  { label: "A_partnerWallet",    buildBody: (w) => ({ partnerWallet: w }) },
  { label: "B_wallet",           buildBody: (w) => ({ wallet: w }) },
  { label: "C_partner",          buildBody: (w) => ({ partner: w }) },
  { label: "D_partnerAuthority", buildBody: (w) => ({ partnerAuthority: w }) },
];

function jsonResponse(
  req: NextRequest,
  requestId: string,
  body: unknown,
  init?: ResponseInit,
) {
  const res = NextResponse.json(body, init);
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set("X-Request-Id", requestId);
  return res;
}

function secretEquals(value: string, expected: string): boolean {
  const v = Buffer.from(value);
  const e = Buffer.from(expected);
  return v.length === e.length && timingSafeEqual(v, e);
}

// sha256Prefix kept only for potential future debug mode; not used in output here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _sha256Prefix(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ["POST"]);
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = getOrGenerateRequestId(req.headers);
  const adminSecret = process.env[ADMIN_SECRET_ENV]?.trim();

  if (!adminSecret) {
    SafeLogger.error("Launchpad upstream-diagnostic admin route is not configured", undefined, {
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
    SafeLogger.warn("Launchpad upstream-diagnostic admin secret rejected", {
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

  SafeLogger.warn("Launchpad upstream-diagnostic initiated", {
    requestId,
    endpoint: ROUTE,
    partnerWallet: BAGS_SHIELD_FEE_SHARE_WALLET,
    variantCount: DIAGNOSTIC_VARIANTS.length,
  });

  // Run variants sequentially with a small gap — avoid hammering Bags API
  const results: PartnerConfigDiagnosticResult[] = [];
  for (let i = 0; i < DIAGNOSTIC_VARIANTS.length; i++) {
    const { label, buildBody } = DIAGNOSTIC_VARIANTS[i];
    const body = buildBody(BAGS_SHIELD_FEE_SHARE_WALLET);
    const result = await probePartnerConfigCreationTx(label, body);
    results.push(result);
    if (i < DIAGNOSTIC_VARIANTS.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  const anyOk = results.some((r) => r.ok);
  const anyTransaction = results.some((r) => r.hasTransaction);

  SafeLogger.info("Launchpad upstream-diagnostic complete", {
    requestId,
    endpoint: ROUTE,
    variantCount: results.length,
    anyOk,
    anyTransaction,
  });

  return jsonResponse(req, requestId, {
    success: true,
    diagnostic: {
      partnerWallet: BAGS_SHIELD_FEE_SHARE_WALLET,
      bagsEndpoint: "/fee-share/partner-config/creation-tx",
      anyOk,
      anyTransaction,
      variants: results,
    },
    meta: {
      requestId,
      elapsedMs: Date.now() - startTime,
    },
  });
}
