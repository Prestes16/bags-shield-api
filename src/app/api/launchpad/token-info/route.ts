/**
 * POST /api/launchpad/token-info
 *
 * Validates the Bags Launch v2 token-info contract and proxies it server-side
 * to Bags without exposing BAGS_API_KEY to the frontend.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getOrGenerateRequestId,
  safeJsonParse,
  checkRateLimitByIp,
  checkIdempotencyKey,
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
  SafeLogger,
} from "@/src/lib/security";
import { handlePreflight } from "@/src/lib/security/cors";
import {
  bagsTokenInfoRequestSchema,
  validateLaunchpadInput,
} from "@/src/lib/launchpad/schemas";
import {
  createTokenInfo,
  type BagsTokenInfoRequest,
} from "@/src/lib/launchpad/bags-client";
import { getLaunchpadMode, isLaunchpadEnabled } from "@/lib/env";

export const runtime = "nodejs";

const ROUTE = "/api/launchpad/token-info";
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ["POST"]);
}

function jsonResponse(req: NextRequest, requestId: string, body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set("X-Request-Id", requestId);
  return res;
}

function normalizeSocialUrl(value: string | undefined, prefix: "https://x.com/" | "https://t.me/") {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${prefix}${trimmed.replace(/^@+/, "")}`;
}

function pickMetadataUri(response: Record<string, unknown>, fallback?: string) {
  const tokenMetadata = response.tokenMetadata;
  if (typeof tokenMetadata === "string" && tokenMetadata.trim()) return tokenMetadata;

  const tokenLaunch = response.tokenLaunch;
  if (tokenLaunch && typeof tokenLaunch === "object") {
    const uri = (tokenLaunch as Record<string, unknown>).uri;
    if (typeof uri === "string" && uri.trim()) return uri;
  }

  return fallback;
}

function pickTokenMint(response: Record<string, unknown>) {
  const tokenMint = response.tokenMint;
  if (typeof tokenMint === "string" && tokenMint.trim()) return tokenMint;

  const tokenLaunch = response.tokenLaunch;
  if (tokenLaunch && typeof tokenLaunch === "object") {
    const nestedMint = (tokenLaunch as Record<string, unknown>).tokenMint;
    if (typeof nestedMint === "string" && nestedMint.trim()) return nestedMint;
  }

  return undefined;
}

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
      typeof value === "object" &&
      "arrayBuffer" in value &&
      "size" in value &&
      "type" in value,
  );
}

function validateImageFile(file: File): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];

  if (file.size <= 0) {
    issues.push({ path: "image", message: "Arquivo de imagem vazio" });
  }

  if (file.size > MAX_IMAGE_BYTES) {
    issues.push({ path: "image", message: "Imagem deve ter no maximo 15MB" });
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    issues.push({ path: "image", message: "Tipo de imagem invalido. Use PNG, JPG, JPEG, GIF ou WebP" });
  }

  return issues;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = getOrGenerateRequestId(req.headers);

  if (!isLaunchpadEnabled()) {
    SafeLogger.warn("Launchpad token-info called while disabled", { requestId, endpoint: ROUTE });
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "FEATURE_DISABLED", message: "Launchpad feature is not enabled" },
        meta: { requestId },
      },
      { status: 503 },
    );
  }

  if (getLaunchpadMode() !== "real") {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: "LAUNCHPAD_REAL_MODE_REQUIRED",
          message: "Launchpad Bags integration is not enabled in real mode",
        },
        meta: { requestId },
      },
      { status: 503 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimitCheck = checkRateLimitByIp(ip, ROUTE);
  if (!rateLimitCheck.allowed) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded" },
        meta: { requestId },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": "20",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rateLimitCheck.resetAt),
        },
      },
    );
  }

  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const idempotencyCheck = checkIdempotencyKey(idempotencyKey, ROUTE);
    if (idempotencyCheck && !idempotencyCheck.allowed) {
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: "IDEMPOTENCY_KEY_CONFLICT",
            message: "Request with this idempotency key already processed",
          },
          meta: { requestId },
        },
        { status: 409 },
      );
    }
  }

  const contentType = req.headers.get("content-type") || "";
  let tokenInfo: BagsTokenInfoRequest & {
    websiteUrl?: string;
    twitterHandle?: string;
    telegramHandle?: string;
  };
  let imageFile: File | undefined;

  if (contentType.includes("application/json")) {
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

    const validation = validateLaunchpadInput(bagsTokenInfoRequestSchema, parseResult.data);
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

    tokenInfo = ("data" in validation ? validation.data : {}) as typeof tokenInfo;
  } else if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (error) {
      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: { code: "BAD_REQUEST", message: "Failed to read multipart form data" },
          issues: [{ path: "<root>", message: error instanceof Error ? error.message : "Invalid multipart form data" }],
          meta: { requestId },
        },
        { status: 400 },
      );
    }

    const maybeImage = formData.get("image");
    if (maybeImage !== null) {
      if (!isUploadFile(maybeImage)) {
        return jsonResponse(
          req,
          requestId,
          {
            success: false,
            error: { code: "VALIDATION_FAILED", message: "Request validation failed" },
            issues: [{ path: "image", message: "Campo image deve ser um arquivo" }],
            meta: { requestId },
          },
          { status: 400 },
        );
      }

      const imageIssues = validateImageFile(maybeImage);
      if (imageIssues.length > 0) {
        return jsonResponse(
          req,
          requestId,
          {
            success: false,
            error: { code: "VALIDATION_FAILED", message: "Request validation failed" },
            issues: imageIssues,
            meta: { requestId },
          },
          { status: 400 },
        );
      }

      imageFile = maybeImage;
    }

    const validation = validateLaunchpadInput(bagsTokenInfoRequestSchema, {
      name: getFormString(formData, "name"),
      symbol: getFormString(formData, "symbol"),
      description: getFormString(formData, "description"),
      imageUrl: getFormString(formData, "imageUrl"),
      metadataUrl: getFormString(formData, "metadataUrl"),
      telegram: getFormString(formData, "telegram"),
      twitter: getFormString(formData, "twitter"),
      website: getFormString(formData, "website"),
    });

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

    tokenInfo = ("data" in validation ? validation.data : {}) as typeof tokenInfo;
  } else {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Content-Type must be application/json or multipart/form-data",
        },
        issues: [{ path: "headers.content-type", message: "Expected application/json or multipart/form-data" }],
        meta: { requestId },
      },
      { status: 415 },
    );
  }

  if (!imageFile && !tokenInfo.imageUrl) {
    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "VALIDATION_FAILED", message: "Request validation failed" },
        issues: [{ path: "image", message: "Envie um arquivo de imagem real ou uma imageUrl publica" }],
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  const elapsedMs = Date.now() - startTime;

  try {
    const bagsResult = await createTokenInfo({
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      description: tokenInfo.description,
      image: imageFile,
      imageUrl: tokenInfo.imageUrl,
      metadataUrl: tokenInfo.metadataUrl,
      website: tokenInfo.website || tokenInfo.websiteUrl,
      twitter: normalizeSocialUrl(tokenInfo.twitter || tokenInfo.twitterHandle, "https://x.com/"),
      telegram: normalizeSocialUrl(tokenInfo.telegram || tokenInfo.telegramHandle, "https://t.me/"),
    });

    if ("error" in bagsResult) {
      SafeLogger.error("Bags token-info request failed", undefined, {
        requestId,
        endpoint: ROUTE,
        errorCode: bagsResult.error.code,
      });

      return jsonResponse(
        req,
        requestId,
        {
          success: false,
          error: {
            code: bagsResult.error.code === "BAGS_NOT_CONFIGURED" ? "BAGS_NOT_CONFIGURED" : "BAGS_TOKEN_INFO_FAILED",
            message: bagsResult.error.message,
          },
          meta: { requestId, upstream: "bags", elapsedMs: Date.now() - startTime },
        },
        { status: bagsResult.error.code === "BAGS_NOT_CONFIGURED" ? 503 : 502 },
      );
    }

    const upstreamResponse = bagsResult.response as Record<string, unknown>;
    const metadataUri = pickMetadataUri(upstreamResponse, tokenInfo.metadataUrl);
    const tokenMint = pickTokenMint(upstreamResponse);

    return jsonResponse(
      req,
      requestId,
      {
        success: true,
        response: {
          ...upstreamResponse,
          tokenMint,
          metadataUri,
        },
        meta: {
          requestId,
          upstream: "bags",
          upstreamStatus: 200,
          elapsedMs: Date.now() - startTime,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    SafeLogger.error("Internal error creating Bags token info", error, {
      requestId,
      endpoint: ROUTE,
      elapsedMs,
    });

    return jsonResponse(
      req,
      requestId,
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        meta: { requestId, elapsedMs: Date.now() - startTime },
      },
      { status: 500 },
    );
  }
}
