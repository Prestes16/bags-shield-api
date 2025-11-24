import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, preflight, guardMethod, noStore, ensureRequestId } from "../lib/cors";

function isBase58ish(s: unknown): s is string {
  return typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  noStore(res);

  if (req.method === "OPTIONS") {
    return preflight(res, ["POST"]);
  }
  if (!guardMethod(req, res, ["POST"])) return;

  const requestId = ensureRequestId(res);
  const mint = (req.body as any)?.mint;

  if (!isBase58ish(mint)) {
    return res.status(400).json({
      success: false,
      error: "mint field is missing or invalid.",
      meta: { requestId },
    });
  }

  const score = 68;
  const grade = score >= 80 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "E";

  return res.status(200).json({
    success: true,
    response: {
      isSafe: score >= 80,
      shieldScore: score,
      grade,
      warnings: [],
      metadata: { mode: "mock", mintLength: mint.length, base: null },
    },
    meta: { requestId },
  });
}
