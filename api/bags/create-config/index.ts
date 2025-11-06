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

type CreateConfigIn = {
  launchWallet: string;      // obrigatório (base58 32–44)
  tipWallet?: string;        // opcional
  tipLamports?: number;      // opcional (>=0, inteiro)
};

function isBase58Like(s: string) {
  return typeof s === "string" && s.length >= 32 && s.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
}

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
        error: "BAGS_API_BASE não configurado (create-config canário desativado).",
        meta: { requestId: rid, ts: Date.now() }
      });
    }

    // parse seguro do body
    const bodyAny = (typeof req.body === "object" && req.body) ? req.body : JSON.parse(String(req.body || "{}"));
    const payload = bodyAny as CreateConfigIn;

    // validações
    if (!payload.launchWallet || !isBase58Like(payload.launchWallet)) {
      return res.status(400).json({
        success: false,
        error: "launchWallet inválido (esperado base58 32–44).",
        meta: { requestId: rid, ts: Date.now() }
      });
    }
    if (payload.tipWallet && !isBase58Like(payload.tipWallet)) {
      return res.status(400).json({
        success: false,
        error: "tipWallet inválido (base58 32–44).",
        meta: { requestId: rid, ts: Date.now() }
      });
    }
    if (payload.tipLamports != null) {
      const n = Number(payload.tipLamports);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        return res.status(400).json({
          success: false,
          error: "tipLamports inválido (inteiro >= 0).",
          meta: { requestId: rid, ts: Date.now() }
        });
      }
      payload.tipLamports = n;
    }

    // forward ao upstream real
    const upstream = await bagsJson<any>("/token-launch/create-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const meta = { ...upstream.meta, requestId: rid, ts: Date.now() };

    if (upstream.success) {
      // upstream costuma retornar { configKey, tx|null }
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