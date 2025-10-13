import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, preflight } from "../../lib/cors.js";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;
const isValidMint = (x: unknown) => {
  const s = typeof x === "string" ? x : String(x ?? "");
  return BASE58_RE.test(s) && s.length >= 32 && s.length <= 44;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return preflight(req, res);
  if (req.method !== "GET") {
    applyCors(req, res);
    res.setHeader("Allow", "GET, OPTIONS");
    res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET | OPTIONS" } });
    return;
  }
  const mint = (req as any)?.query?.mint as string | undefined;
  applyCors(req, res);
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (!isValidMint(mint)) {
    res.status(400).json({ success: false, error: { code: "BAD_MINT", message: "Parâmetro :mint inválido (Base58 32–44 chars)" } });
    return;
  }

  // Valor exemplo (mock, em lamports)
  const data = { mint, lifetimeFees: { total: 123456789, unit: "lamports" } };
  res.status(200).json({ success: true, response: data });
}