import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, guardMethod, noStore, ensureRequestId } from "../lib/cors.js";
import { rateLimitMiddleware } from "../lib/rate.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Tratamento CORS manual sÃ³ para OPTIONS (preflight)
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
    res.setHeader("Access-Control-Max-Age", "86400");
    return res.status(204).end();
  }

  // Para os demais métodos, usamos o pipeline padrão
  setCors(res, req);
  noStore(res);

  if (!guardMethod(req, res, ["POST"])) return;

  // Rate limiting (only active if env vars are set)
  if (!rateLimitMiddleware(req, res)) {
    return;
  }

  const requestId = ensureRequestId(res);

  try {
    return res.status(200).json({
      success: true,
      response: { applied: true },
      meta: { requestId },
    });
  } catch (err: any) {
    console.error("[apply] Error:", err?.message || String(err));
    const isDev = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "development";
    return res.status(500).json({
      success: false,
      error: "internal_error",
      message: isDev ? (err?.message || String(err)) : "internal server error",
      meta: { requestId },
    });
  }
}
