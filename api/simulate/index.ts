import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";
import { setCors, preflight, guardMethod, noStore } from "../../lib/cors";

function isBase58ish(s: unknown): s is string {
  // 32–44 chars no alfabeto base58 (sem 0 O I l)
  return typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

function safeParse(body: unknown): any {
  if (typeof body === "object" && body !== null) return body as any;
  try { return JSON.parse(String(body ?? "{}")); } catch { return {}; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return preflight(res, ["POST"], ["Content-Type","Authorization","x-api-key"]);
  guardMethod(req, res, ["POST"]);
  noStore(res);

  const requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", requestId);

  const body = safeParse(req.body);
  const mint: unknown = body?.mint;

  if (!isBase58ish(mint)) {
    return res.status(400).json({
      success: false,
      error: "mint field is missing or invalid.",
      meta: { requestId }
    });
  }

  const score = 68; // mock estável para integração
  const grade = score >= 80 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "E";

  return res.status(200).json({
    success: true,
    response: {
      isSafe: score >= 80,
      shieldScore: score,
      grade,
      warnings: [],
      metadata: { mode: "real", mintLength: (mint as string).length, base: null }
    },
    meta: { requestId }
  });
}