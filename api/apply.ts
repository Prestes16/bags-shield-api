import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, guardMethod, noStore, ensureRequestId } from '.js';
import { rateLimitMiddleware } from '../lib/rate.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Tratamento CORS manual sÃ³ para OPTIONS (preflight)
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
    res.setHeader("Access-Control-Max-Age", "86400");
    return res.status(204).end();
  }

  // Para os demais mÃ©todos, usamos o pipeline padrÃ£o
  setCors(res);
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
    return res.status(500).json({
      success: false,
      error: "internal_error",
      details: String(err?.message ?? err),
      meta: { requestId },
    });
  }
}
