import type { VercelRequest, VercelResponse } from "@vercel/node";

// Usa helpers de CORS se existirem no projeto.
// Se não existirem, respondemos CORS básico inline.
let setCors: ((res: VercelResponse)=>void) | null = null;
let preflight: ((res: VercelResponse)=>void) | null = null;
let noStore: ((res: VercelResponse)=>void) | null = null;
try {
  // caminho relativo: api/bags/_diag -> api -> raiz -> lib/cors
  // @ts-ignore
  const cors = require("../../../lib/cors");
  setCors = cors.setCors || null;
  preflight = cors.preflight || null;
  noStore = cors.noStore || null;
} catch {}

function basicCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  (setCors ? setCors(res) : basicCors(res));
  (noStore ? noStore(res) : res.setHeader("Cache-Control","no-store"));

  if (req.method === "OPTIONS") {
    (preflight ? preflight(res) : res.status(204).end());
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ success:false, error:"Method Not Allowed", meta:{ requestId: req.headers["x-request-id"] || null }});
    return;
  }

  const key = (process.env.BAGS_API_KEY || "").trim();
  const base = (process.env.BAGS_API_BASE || "").trim() || null;
  const timeoutMs = Number(process.env.BAGS_TIMEOUT_MS || 5000);

  // Apenas um "preview" do que seria enviado (sem vazar segredo)
  const willSendHeaders = key.length > 0 ? ["x-api-key","authorization"] : [];

  res.status(200).json({
    success: true,
    response: {
      hasKey: key.length > 0,
      keyLength: key.length,
      base,
      timeoutMs,
      willSendHeaders
    },
    meta: { requestId: req.headers["x-request-id"] || null }
  });
}