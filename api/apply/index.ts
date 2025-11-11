import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";
import { setCors, preflight, guardMethod, noStore } from "../../lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") {
    return preflight(res, ["POST"], ["Content-Type","Authorization","x-api-key"]);
  }
  guardMethod(req, res, ["POST"]);
  noStore(res);

  const requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", requestId);

  // Nenhuma mutação real aqui — apenas ecoa o OK no formato padrão
  return res.status(200).json({
    success: true,
    response: { applied: true },
    meta: { requestId }
  });
}