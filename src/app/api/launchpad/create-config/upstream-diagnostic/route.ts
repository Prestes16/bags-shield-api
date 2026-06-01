/**
 * POST /api/launchpad/create-config/upstream-diagnostic
 *
 * Admin-only route for diagnosing Bags /fee-share/config upstream failures.
 * It never signs, never broadcasts, never calls /send, and never returns raw
 * transaction values. Results expose only payload shape and sanitized upstream
 * metadata.
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
  bagsFeeShareConfigRequestSchema,
  validateLaunchpadInput,
} from "@/lib/launchpad/schemas";
import {
  createFeeShareConfig,
  type BagsFeeShareConfigRequest,
  type BagsFeeShareConfigResponse,
  type BagsResult,
} from "@/lib/launchpad/bags-client";
import {
  BAGS_SHIELD_FEE_SHARE_WALLET,
  buildLaunchpadFeeShare,
} from "@/lib/launchpad/fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/launchpad/create-config/upstream-diagnostic";
const ADMIN_SECRET_ENV = "LAUNCHPAD_ADMIN_SECRET";
const ADMIN_HEADER = "x-admin-secret";
const PARTNER_CONFIG_ENV = "LAUNCHPAD_PARTNER_CONFIG";

type PayloadShape = Record<string, unknown>;

interface DiagnosticVariant {
  variant: string;
  payload: PayloadShape;
}

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

function secretEquals(value: string, expected: string) {
  const valueBytes = Buffer.from(value);
  const expectedBytes = Buffer.from(expected);
  return valueBytes.length === expectedBytes.length && timingSafeEqual(valueBytes, expectedBytes);
}

function getServerPartnerConfig(): string | null {
  const raw = process.env[PARTNER_CONFIG_ENV]?.trim();
  if (!raw) return null;
  try {
    return new PublicKey(raw).toBase58();
  } catch {
    return null;
  }
}

function omitKeys(payload: PayloadShape, keys: string[]): PayloadShape {
  const next: PayloadShape = { ...payload };
  for (const key of keys) delete next[key];
  return next;
}

function fieldType(value: unknown): string {
  if (Array.isArray(value)) {
    const sample = value.find((item) => item !== undefined && item !== null);
    return `array:${sample === undefined ? "unknown" : typeof sample}`;
  }
  if (value === null) return "null";
  return typeof value;
}

function summarizePayload(payload: PayloadShape) {
  const sentKeys = Object.keys(payload);
  const claimersArray = Array.isArray(payload.claimersArray) ? payload.claimersArray : [];
  const basisPointsArray = Array.isArray(payload.basisPointsArray) ? payload.basisPointsArray : [];
  const basisPointsSum = basisPointsArray.reduce(
    (total, value) => total + (typeof value === "number" ? value : 0),
    0,
  );

  return {
    sentKeys,
    fieldTypes: Object.fromEntries(sentKeys.map((key) => [key, fieldType(payload[key])])),
    claimersLength: claimersArray.length,
    basisPointsLength: basisPointsArray.length,
    claimersAndBasisPointsAligned: claimersArray.length === basisPointsArray.length,
    basisPointsSum,
    hasPartner: typeof payload.partner === "string" && payload.partner.trim().length > 0,
    hasPartnerConfig:
      typeof payload.partnerConfig === "string" && payload.partnerConfig.trim().length > 0,
    hasBagsConfigType:
      typeof payload.bagsConfigType === "string" && payload.bagsConfigType.trim().length > 0,
    hasAdditionalLookupTables:
      Array.isArray(payload.additionalLookupTables) && payload.additionalLookupTables.length > 0,
    hasTipWallet: typeof payload.tipWallet === "string" && payload.tipWallet.trim().length > 0,
    hasTipLamports: typeof payload.tipLamports === "number" && payload.tipLamports > 0,
  };
}

function getUpstreamStatus(details?: Record<string, unknown>) {
  const status = details?.status;
  return typeof status === "number" ? status : undefined;
}

function getUpstreamString(details: Record<string, unknown> | undefined, key: string) {
  const value = details?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function inspectTransaction(value: unknown): { transactionPresent: boolean; transactionLength?: number } {
  let maxLength = 0;
  const txKeys = new Set(["transaction", "tx", "serializedTransaction", "signedTransaction"]);

  function visit(node: unknown, key?: string) {
    if (typeof node === "string") {
      if (key && txKeys.has(key) && node.trim()) {
        maxLength = Math.max(maxLength, node.trim().length);
      }
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    if (!node || typeof node !== "object") return;
    for (const [childKey, childValue] of Object.entries(node as Record<string, unknown>)) {
      visit(childValue, childKey);
    }
  }

  visit(value);
  return maxLength > 0
    ? { transactionPresent: true, transactionLength: maxLength }
    : { transactionPresent: false };
}

function configKeyPresent(response: unknown) {
  if (!response || typeof response !== "object" || Array.isArray(response)) return false;
  const record = response as Record<string, unknown>;
  return (
    (typeof record.configKey === "string" && record.configKey.trim().length > 0) ||
    (typeof record.meteoraConfigKey === "string" && record.meteoraConfigKey.trim().length > 0)
  );
}

function summarizeResult(
  variant: string,
  payload: PayloadShape,
  result: BagsResult<BagsFeeShareConfigResponse>,
) {
  const shape = summarizePayload(payload);

  if ("error" in result) {
    const upstreamStatus = getUpstreamStatus(result.error.details);
    const upstreamCode = getUpstreamString(result.error.details, "upstreamCode") || result.error.code;
    const upstreamMessage =
      getUpstreamString(result.error.details, "upstreamMessage") || result.error.message;
    const rawResponseHint = getUpstreamString(result.error.details, "rawResponseHint");

    return {
      variant,
      ...shape,
      ok: false,
      upstreamStatus,
      upstreamCode,
      upstreamMessage,
      rawResponseHint,
      transactionPresent: false,
      configKeyPresent: false,
    };
  }

  const tx = inspectTransaction(result.response);
  return {
    variant,
    ...shape,
    ok: true,
    upstreamStatus: 200,
    transactionPresent: tx.transactionPresent,
    ...(tx.transactionLength ? { transactionLength: tx.transactionLength } : {}),
    configKeyPresent: configKeyPresent(result.response),
  };
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ["POST"]);
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = getOrGenerateRequestId(req.headers);
  const adminSecret = process.env[ADMIN_SECRET_ENV]?.trim();

  if (!adminSecret) {
    SafeLogger.error("Launchpad create-config diagnostic admin route is not configured", undefined, {
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
    SafeLogger.warn("Launchpad create-config diagnostic admin secret rejected", {
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

  let bodyText: string;
  try {
    bodyText = await req.text();
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

  const parseResult = safeJsonParse<unknown>(bodyText);
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

  const validation = validateLaunchpadInput(bagsFeeShareConfigRequestSchema, parseResult.data);
  if (!validation.ok) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "VALIDATION_FAILED", message: "Request validation failed" },
        issues: "issues" in validation ? validation.issues : [],
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  const input = ("data" in validation ? validation.data : {}) as BagsFeeShareConfigRequest;
  const serverPartnerConfig = getServerPartnerConfig();
  if (!serverPartnerConfig) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: "LAUNCHPAD_PARTNER_CONFIG_NOT_CONFIGURED",
          message: "Launchpad partner config is not configured on the server",
        },
        meta: { requestId, elapsedMs: Date.now() - startTime },
      },
      { status: 503 },
    );
  }

  let feeShare: ReturnType<typeof buildLaunchpadFeeShare>;
  try {
    feeShare = buildLaunchpadFeeShare(input.payer);
  } catch (error) {
    SafeLogger.error("Launchpad create-config diagnostic fee-share unavailable", error, {
      requestId,
      endpoint: ROUTE,
    });
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: "FEE_CONFIGURATION_UNAVAILABLE",
          message: error instanceof Error ? error.message : "Launchpad fee-share configuration is unavailable",
        },
        meta: { requestId, elapsedMs: Date.now() - startTime },
      },
      { status: 503 },
    );
  }

  const currentPayload: PayloadShape = {
    payer: input.payer,
    baseMint: input.baseMint,
    claimersArray: feeShare.claimersArray,
    basisPointsArray: feeShare.basisPointsArray,
    partner: BAGS_SHIELD_FEE_SHARE_WALLET,
    partnerConfig: serverPartnerConfig,
    ...(input.bagsConfigType ? { bagsConfigType: input.bagsConfigType } : {}),
    ...(input.additionalLookupTables ? { additionalLookupTables: input.additionalLookupTables } : {}),
  };

  const variants: DiagnosticVariant[] = [
    { variant: "A_current_complete", payload: currentPayload },
    { variant: "B_without_partner", payload: omitKeys(currentPayload, ["partner"]) },
    { variant: "C_without_partnerConfig", payload: omitKeys(currentPayload, ["partnerConfig"]) },
    { variant: "D_without_partner_and_partnerConfig", payload: omitKeys(currentPayload, ["partner", "partnerConfig"]) },
    {
      variant: "E_minimal_fee_share",
      payload: {
        payer: input.payer,
        baseMint: input.baseMint,
        claimersArray: feeShare.claimersArray,
        basisPointsArray: feeShare.basisPointsArray,
      },
    },
  ];

  SafeLogger.warn("Launchpad create-config upstream diagnostic initiated", {
    requestId,
    endpoint: ROUTE,
    variantCount: variants.length,
    feeShareKeys: ["payer", "baseMint", "claimersArray", "basisPointsArray"],
    totalBps: feeShare.totalBps,
    tipsEnabled: false,
  });

  const results = [];
  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    const result = await createFeeShareConfig(variant.payload as unknown as BagsFeeShareConfigRequest);
    results.push(summarizeResult(variant.variant, variant.payload, result));
    if (i < variants.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  const anyOk = results.some((result) => result.ok);
  const anyTransaction = results.some((result) => result.transactionPresent);
  const anyConfigKey = results.some((result) => result.configKeyPresent);

  SafeLogger.info("Launchpad create-config upstream diagnostic complete", {
    requestId,
    endpoint: ROUTE,
    variantCount: results.length,
    anyOk,
    anyTransaction,
    anyConfigKey,
  });

  return jsonResponse(req, requestId, {
    success: true,
    response: {
      bagsEndpoint: "/fee-share/config",
      partnerWallet: BAGS_SHIELD_FEE_SHARE_WALLET,
      partnerConfigPresent: Boolean(serverPartnerConfig),
      anyOk,
      anyTransaction,
      anyConfigKey,
      fees: {
        creatorBps: feeShare.creatorFeeShareBps,
        bagsShieldBps: feeShare.bagsShieldFeeShareBps,
        totalBps: feeShare.totalBps,
        claimersLength: feeShare.claimersArray.length,
        basisPointsLength: feeShare.basisPointsArray.length,
      },
      tips: {
        enabled: false,
        tipWallet: null,
        tipLamports: 0,
      },
      variants: results,
    },
    meta: {
      requestId,
      upstream: "bags",
      elapsedMs: Date.now() - startTime,
    },
  });
}
