import type { VercelRequest, VercelResponse } from "@vercel/node";

// Dynamic import for cors helpers (same pattern as simulate.ts)
async function getCorsHelpers() {
  try {
    return await import("../lib/cors.js");
  } catch (error) {
    console.error("[scan] Error importing cors module:", error);
    // Fallback implementations
    return {
      setCors: (res: VercelResponse, req?: VercelRequest) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
      },
      preflight: (res: VercelResponse, methods: string[], headers: string[], req?: VercelRequest) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", methods.join(","));
        res.setHeader("Access-Control-Allow-Headers", headers.join(","));
        res.setHeader("Cache-Control", "no-store");
        const id = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
        res.setHeader("X-Request-Id", id);
        res.status(204).end();
      },
      guardMethod: (req: VercelRequest, res: VercelResponse, allowed: string[]): boolean => {
        const method = req.method ?? "";
        if (!allowed.includes(method)) {
          res.status(405).json({ success: false, error: "method_not_allowed", meta: { requestId: "unknown" } });
          return false;
        }
        return true;
      },
      noStore: (res: VercelResponse) => {
        res.setHeader("Cache-Control", "no-store");
      },
      ensureRequestId: (res: VercelResponse): string => {
        const id = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
        res.setHeader("X-Request-Id", id);
        return id;
      },
    };
  }
}

function isBase64Like(s: string): boolean {
  if (!s || typeof s !== "string") return false;
  if (s.length < 32) return false;
  if (s.length > 200_000) return false; // guarda pra não virar lixão
  // base64 padrão (+/) ou urlsafe (-_)
  return /^[A-Za-z0-9+/_-]+={0,2}$/.test(s);
}

function parseBody(req: VercelRequest): any {
  if (typeof req.body === "object" && req.body !== null && !Array.isArray(req.body)) {
    return req.body;
  }
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      throw new Error("invalid json");
    }
  }
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  let requestId = "unknown";
  
  try {
    const cors = await getCorsHelpers();
    requestId = cors.ensureRequestId(res);
    
    cors.setCors(res, req);
    if (req.method === "OPTIONS") {
      return cors.preflight(res, ["POST"], ["Content-Type", "Authorization", "x-api-key"], req);
    }
    if (!cors.guardMethod(req, res, ["POST"])) return;

    cors.noStore(res);

    let body: any;
    try {
      body = parseBody(req);
    } catch (e: any) {
      return res.status(400).json({
        success: false,
        error: "invalid json",
        meta: { requestId }
      });
    }

    const rawTransaction = body?.rawTransaction ?? body?.raw_transaction ?? body?.tx ?? "";
    const network = (body?.network ?? "mainnet").toString();
    const wallet = body?.wallet ? String(body.wallet) : undefined;
    const source = body?.source ? String(body.source) : undefined;

    if (!isBase64Like(rawTransaction)) {
      return res.status(400).json({
        success: false,
        error: "invalid rawTransaction (expected base64 string)",
        meta: { requestId }
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
        meta: { network, wallet, source, requestId }
      },
      meta: { requestId }
    });
  } catch (e: any) {
    console.error("[scan] Error:", e?.message || String(e));
    const isDev = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "development";
    const errorMessage = isDev ? (e?.message || String(e)) : "internal server error";
    return res.status(500).json({ 
      success: false, 
      error: "scan_failed",
      message: errorMessage,
      meta: { requestId }
    });
  }
}
