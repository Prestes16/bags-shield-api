import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, preflight, guardMethod, noStore, ensureRequestId } from "../../lib/cors";

function isB64ish(s: any): s is string {
  return typeof s === "string"
    && /^[A-Za-z0-9+/=]+$/.test(s)
    && s.length >= 64
    && (s.length % 4 === 0);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res); noStore(res);
  if (req.method === "OPTIONS") return preflight(res, ["POST"]);
  if (!guardMethod(req, res, ["POST"])) return;

  const requestId = ensureRequestId(res);
  const raw = (req.body as any)?.rawTransaction;

  if (!isB64ish(raw)) {
    return res.status(400).json({
      success: false,
      error: "rawTransaction field is missing or invalid.",
      meta: { requestId }
    });
  }

  const score = Math.max(0, 100 - raw.length);
  const grade = score >= 80 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "E";

  return res.status(200).json({
    success: true,
    response: {
      isSafe: score >= 80,
      shieldScore: score,
      grade,
      warnings: [],
      metadata: { mode: "mock", rawLength: raw.length, base: null }
    },
    meta: { requestId }
  });
}