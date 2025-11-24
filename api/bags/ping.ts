import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, noStore } from "../../lib/cors";
import {
  pingBagsConfig,
  type BagsResult,
  type BagsPingResponse,
} from "../../lib/bags";
import { randomUUID } from "node:crypto";

function newRequestId(): string {
  try {
    return randomUUID();
  } catch {
    return (
      Math.random().toString(16).slice(2) +
      "-" +
      Date.now().toString(16)
    );
  }
}

function sendJson(
  res: VercelResponse,
  status: number,
  body: any,
  requestId: string
) {
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).json(body);
}

function extractError<T>(
  result: BagsResult<T>
): { code: string; details?: any } {
  const anyResult = result as any;

  if (anyResult && typeof anyResult === "object" && anyResult.error) {
    const err = anyResult.error;
    return {
      code: typeof err.code === "string" ? err.code : "UNKNOWN",
      details: err.details ?? {},
    };
  }

  return { code: "UNKNOWN", details: {} };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  noStore(res);

  const requestId = newRequestId();

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    return sendJson(
      res,
      405,
      {
        success: false,
        error: {
          code: "METHOD_NOT_ALLOWED",
          details: { allowed: ["GET"] },
        },
        meta: { requestId },
      },
      requestId
    );
  }

  let result: BagsResult<BagsPingResponse>;

  try {
    result = await pingBagsConfig();
  } catch (err) {
    return sendJson(
      res,
      502,
      {
        success: false,
        error: {
          code: "UPSTREAM_UNEXPECTED_ERROR",
          details: {
            message: err instanceof Error ? err.message : String(err),
          },
        },
        meta: { requestId },
      },
      requestId
    );
  }

  if (!result.success) {
    const err = extractError(result);

    let status = 500;
    if (err.code === "UPSTREAM_RATE_LIMITED") status = 429;
    else if (
      err.code === "UPSTREAM_REQUEST_FAILED" ||
      err.code === "UPSTREAM_BAD_RESPONSE"
    ) status = 502;
    else if (err.code === "BAGS_NOT_CONFIGURED") status = 500;

    return sendJson(
      res,
      status,
      {
        success: false,
        error: err,
        meta: { requestId },
      },
      requestId
    );
  }

  return sendJson(
    res,
    200,
    {
      success: true,
      response: result.response,
      meta: { requestId },
    },
    requestId
  );
}
