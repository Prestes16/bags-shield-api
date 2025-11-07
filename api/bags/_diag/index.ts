import type { VercelRequest, VercelResponse } from "@vercel/node";

function setNoStore(res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
}

function setCors(res: VercelResponse) {
  // Diag é interno; mantemos permissivo só aqui
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-api-key");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  setNoStore(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method Not Allowed", meta: { method: req.method } });
    return;
  }

  const apiKey = process.env.BAGS_API_KEY || "";
  const apiBase = (process.env.BAGS_API_BASE || "https://public-api-v2.bags.fm/api/v1").replace(/\/+$/,"");
  const pingUrl = apiBase + "/ping";

  let upstreamStatus: number | null = null;
  try {
    const headers: Record<string,string> = { "Accept": "application/json" };
    if (apiKey) {
      headers["x-api-key"] = apiKey;
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    const r = await fetch(pingUrl, { method: "GET", headers });
    upstreamStatus = r.status;
  } catch {
    upstreamStatus = -1; // erro de rede/DNS/etc
  }

  res.status(200).json({
    ok: true,
    diag: {
      hasApiKey: Boolean(apiKey),
      apiKeyLen: apiKey.length,
      apiBase: apiBase,              // sem segredos
      upstreamPingStatus: upstreamStatus // 200/401/403/-1
    },
    meta: { note: "Nenhum segredo é exposto; apenas flags/len/status." }
  });
}