import type { VercelResponse } from "@vercel/node";
import { setCors, noStore, ensureRequestId } from "./cors";

/**
 * Envelope padrão de resposta da API.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  response?: T;
  error?: string | { code: string; message: string; details?: unknown };
  meta: {
    requestId: string;
    upstream?: string;
    upstreamStatus?: number;
    elapsedMs?: number;
    mode?: string;
  };
}

/**
 * Aplica headers padrão (CORS, no-store, X-Request-Id) e retorna requestId.
 */
export function applyStandardHeaders(res: VercelResponse): string {
  setCors(res);
  noStore(res);
  return ensureRequestId(res);
}

/**
 * Resposta de sucesso (200).
 */
export function ok<T>(
  res: VercelResponse,
  data: T,
  requestId?: string,
  meta?: Partial<ApiResponse["meta"]>
): void {
  const rid = requestId || applyStandardHeaders(res);
  res.status(200).json({
    success: true,
    response: data,
    meta: { requestId: rid, ...meta },
  });
}

/**
 * Resposta de erro genérico.
 */
export function fail(
  res: VercelResponse,
  status: number,
  error: string | { code: string; message: string; details?: unknown },
  requestId?: string,
  meta?: Partial<ApiResponse["meta"]>
): void {
  const rid = requestId || applyStandardHeaders(res);
  const errorObj =
    typeof error === "string"
      ? { code: "ERROR", message: error }
      : error;

  res.status(status).json({
    success: false,
    error: errorObj,
    meta: { requestId: rid, ...meta },
  });
}

/**
 * Bad Request (400).
 */
export function badRequest(
  res: VercelResponse,
  message: string,
  requestId?: string,
  details?: unknown
): void {
  const errorObj: { code: string; message: string; details?: unknown } = {
    code: "BAD_REQUEST",
    message,
  };
  if (details !== undefined) {
    errorObj.details = details;
  }
  fail(res, 400, errorObj, requestId);
}

/**
 * Unauthorized (401).
 */
export function unauthorized(
  res: VercelResponse,
  message: string = "Unauthorized",
  requestId?: string
): void {
  fail(
    res,
    401,
    {
      code: "UNAUTHORIZED",
      message,
    },
    requestId
  );
}

/**
 * Not Found (404).
 */
export function notFound(
  res: VercelResponse,
  message: string = "Not Found",
  requestId?: string
): void {
  fail(
    res,
    404,
    {
      code: "NOT_FOUND",
      message,
    },
    requestId
  );
}

/**
 * Method Not Allowed (405).
 */
export function methodNotAllowed(
  res: VercelResponse,
  allowed: string[],
  requestId?: string
): void {
  const rid = requestId || applyStandardHeaders(res);
  res.setHeader("Allow", allowed.join(", "));
  fail(
    res,
    405,
    {
      code: "METHOD_NOT_ALLOWED",
      message: `Method not allowed. Allowed methods: ${allowed.join(", ")}`,
    },
    rid
  );
}

/**
 * Unsupported Media Type (415).
 */
export function unsupportedMediaType(
  res: VercelResponse,
  expected: string = "application/json",
  requestId?: string
): void {
  fail(
    res,
    415,
    {
      code: "UNSUPPORTED_MEDIA_TYPE",
      message: `Expected Content-Type: ${expected}`,
    },
    requestId
  );
}

/**
 * Payload Too Large (413).
 */
export function payloadTooLarge(
  res: VercelResponse,
  message: string = "Request body too large",
  requestId?: string
): void {
  fail(
    res,
    413,
    {
      code: "PAYLOAD_TOO_LARGE",
      message,
    },
    requestId
  );
}

/**
 * Internal Server Error (500).
 */
export function internalError(
  res: VercelResponse,
  message: string = "Internal server error",
  requestId?: string,
  details?: unknown
): void {
  const errorObj: { code: string; message: string; details?: unknown } = {
    code: "INTERNAL_ERROR",
    message,
  };
  if (details !== undefined) {
    errorObj.details = details;
  }
  fail(res, 500, errorObj, requestId);
}

/**
 * Bad Gateway (502) - usado para erros de upstream.
 */
export function badGateway(
  res: VercelResponse,
  message: string,
  requestId?: string,
  meta?: { upstream?: string; upstreamStatus?: number; elapsedMs?: number }
): void {
  fail(
    res,
    502,
    {
      code: "BAD_GATEWAY",
      message,
    },
    requestId,
    meta
  );
}

/**
 * Service Unavailable (503).
 */
export function serviceUnavailable(
  res: VercelResponse,
  message: string = "Service temporarily unavailable",
  requestId?: string
): void {
  fail(
    res,
    503,
    {
      code: "SERVICE_UNAVAILABLE",
      message,
    },
    requestId
  );
}
