import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, guardMethod, noStore, ensureRequestId } from "../../lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS + cache
  setCors(res);
  noStore(res);

  // Permitimos GET e HEAD
  if (!guardMethod(req, res, ["GET", "HEAD"])) return;

  const requestId = ensureRequestId(res);

  // HEAD: só confirma que a rota existe
  if (req.method === "HEAD") {
    return res.status(204).end();
  }

  const now = Math.floor(Date.now() / 1000);

  return res.status(200).json({
    success: true,
    response: {
      upstream: "bags-mock",
      mode: "dev-local",
      ok: true
    },
    meta: {
      requestId,
      rateLimitRemaining: 1000,
      rateLimitLimit: 1000,
      rateLimitReset: now + 3600
    }
  });
}
