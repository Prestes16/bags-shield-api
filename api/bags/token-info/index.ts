import type { VercelRequest, VercelResponse } from "@vercel/node";
import { CONFIG } from "../../../lib/constants";
import { bagsJson } from "../../../lib/bags";

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
}
function noStore(res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
}
function reqId() {
  return "req_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type TokenInfoIn = {
  imageUrl?: string;          // preferido inicialmente (evita multipart)
  metadataUrl?: string;       // opcional: pula upload
  name: string;               // <= 32
  symbol: string;             // <= 10 (UPCASE recomendado)
  description?: string;       // <= 1000
  telegram?: string;
  twitter?: string;
  website?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  noStore(res);

  const rid = reqId();
  res.setHeader("X-Request-Id", rid);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method Not Allowed", meta: { requestId: rid } });
  }

  try {
    if (!CONFIG.BAGS_API_BASE) {
      return res.status(501).json({
        success: false,
        error: "BAGS_API_BASE não configurado (token-info canário desativado).",
        meta: { requestId: rid, ts: Date.now() }
      });
    }

    // parse/validação leve
    const payload = (typeof req.body === "object" && req.body) ? req.body as TokenInfoIn : JSON.parse(String(req.body || "{}"));
    const { name, symbol, imageUrl, metadataUrl } = payload;

    if (!name || !symbol) {
      return res.status(400).json({
        success: false,
        error: "Campos obrigatórios ausentes: name e symbol.",
        meta: { requestId: rid, ts: Date.now() }
      });
    }
    if (!imageUrl && !metadataUrl) {
      return res.status(400).json({
        success: false,
        error: "Forneça imageUrl ou metadataUrl (evitamos multipart nesse canário).",
        meta: { requestId: rid, ts: Date.now() }
      });
    }

    // forward para o upstream real
    const upstream = await bagsJson<any>("/token-launch/create-token-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const meta = { ...upstream.meta, requestId: rid, ts: Date.now() };

    if (upstream.success) {
      return res.status(200).json({ success: true, response: upstream.response, meta });
    } else {
      const bad = upstream.meta.status || 502;
      return res.status(bad).json({ success: false, error: upstream.error, meta });
    }
  } catch (e: any) {
    return res.status(502).json({
      success: false,
      error: String(e?.message ?? e),
      meta: { requestId: rid, ts: Date.now() }
    });
  }
}