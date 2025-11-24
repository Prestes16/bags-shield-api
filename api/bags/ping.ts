import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "crypto";
import { bagsPing } from "../../lib/bags";
import type { BagsFailure } from "../../lib/bags";

function newRequestId(): string {
  try {
    return randomUUID();
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const requestId = newRequestId();
  res.setHeader("X-Request-Id", requestId);

  // HEAD: só confirma que a rota existe
  if (req.method === "HEAD") {
    res.status(200).json({
      success: true,
      response: null,
      meta: { requestId },
    });
    return;
  }

  // Só aceitamos GET aqui
  if (req.method !== "GET") {
    res.status(405).json({
      success: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        details: { method: req.method },
      },
      meta: { requestId },
    });
    return;
  }

  const result = await bagsPing();

  if (!result.success) {
    const failure = result as BagsFailure;
    const err = failure.error;

    res.status(502).json({
      success: false,
      error: {
        code: err.code,
        details: {
          ...(err.details ?? {}),
          upstream: "bags",
        },
      },
      meta: { requestId },
    });
    return;
  }

  res.status(200).json({
    success: true,
    response: result.response,
    meta: { requestId },
  });
}
