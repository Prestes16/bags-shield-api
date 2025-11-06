import type { VercelRequest, VercelResponse } from "@vercel/node";
import { CONFIG } from "../../../lib/constants";
import { bagsJson } from "../../../lib/bags";

// Se você já tiver helpers de CORS, pode trocar por eles.
// Aqui deixo um CORS mínimo e no-store para não quebrar.
function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
}
function noStore(res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
}
function reqId() {
  return "req_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  noStore(res);

  const rid = reqId();
  res.setHeader("X-Request-Id", rid);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method Not Allowed", meta: { requestId: rid } });
  }

  try {
    if (!CONFIG.BAGS_API_BASE) {
      // Sem base configurada: sinaliza claramente no HTTP
      return res.status(501).json({
        success: false,
        error: "BAGS_API_BASE não configurado (canário desativado).",
        meta: { requestId: rid, ts: Date.now() }
      });
    }

    // Upstream real (ex.: https://public-api-v2.bags.fm/api/v1/ping)
    const upstream = await bagsJson<{ message?: string }>("/ping", { method: "GET" });
    const meta = { ...upstream.meta, requestId: rid, ts: Date.now() };

    if (upstream.success) {
      return res.status(200).json({ success: true, response: upstream.response, meta });
    } else {
      // Propaga um status ruim para o frontend marcar ERRO corretamente
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