import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors, preflight, guardMethod, noStore } from "../lib/cors";

function isBase64Like(s: string) {
  if (!s || typeof s !== "string") return false;
  if (s.length < 32) return false;
  if (s.length > 200_000) return false; // guarda pra não virar lixão
  // base64 padrão (+/) ou urlsafe (-_)
  return /^[A-Za-z0-9+/_-]+={0,2}$/.test(s);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    setCors(res, req);
    if (req.method === "OPTIONS") return preflight(res, ["POST"], ["Content-Type", "Authorization", "x-api-key"], req);
    if (!guardMethod(req, res, ["POST"])) return;

    noStore(res);

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const rawTransaction = body?.rawTransaction ?? body?.raw_transaction ?? body?.tx ?? "";
    const network = (body?.network ?? "mainnet").toString();
    const wallet = body?.wallet ? String(body.wallet) : undefined;
    const source = body?.source ? String(body.source) : undefined;

    if (!isBase64Like(rawTransaction)) {
      return res.status(400).json({
        success: false,
        error: "invalid rawTransaction (expected base64 string)"
      });
    }

    // MOCK v0 (pronto pra plugar scan real depois)
    const shieldScore = 80;
    const grade = "B";
    const badges = [
      { id: "tx_format", severity: "low", label: "Transaction format OK" },
      { id: "precheck", severity: "low", label: "Pre-check passed" }
    ];

    return res.status(200).json({
      success: true,
      response: {
        isSafe: true,
        shieldScore,
        grade,
        warnings: [],
        badges,
        meta: { network, wallet, source }
      }
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: "scan failed" });
  }
}
