import type { VercelRequest, VercelResponse } from "@vercel/node";

/* health: monolithic + CORS + no-store + HEAD + X-Request-Id */
function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization,content-type,x-requested-with");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
}
function preflight(_req: VercelRequest, res: VercelResponse) { setCors(res); newRequestId(res); res.status(204).end(); }
function noStore(res: VercelResponse) { res.setHeader("Cache-Control","no-store"); }
function newRequestId(res: VercelResponse) {
  let rid = String(res.getHeader("X-Request-Id") || "");
  if (!rid) {
    try { rid = (globalThis as any).crypto?.randomUUID?.() || ""; } catch {}
    if (!rid) rid = "req_" + Math.random().toString(36).slice(2,10) + "_" + Date.now().toString(36);
    res.setHeader("X-Request-Id", rid);
  }
  return rid;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const method = (req.method || "GET").toUpperCase();
  if (method === "OPTIONS") return preflight(req, res);
  setCors(res); const _rid = newRequestId(res);

  if (method === "HEAD") { noStore(res); return res.status(200).end(); }
  if (method !== "GET") {
    res.setHeader("Allow","GET, HEAD, OPTIONS");
    noStore(res);
    return res.status(405).json({ ok:false, error:{ code:"METHOD_NOT_ALLOWED", message:"Use GET | HEAD | OPTIONS" },
      meta:{ service:"bags-shield-api", version:"1.0.0", time:new Date().toISOString(), requestId:_rid }});
  }

  noStore(res);
  const now = new Date().toISOString();
  const env = process.env.VERCEL_ENV || "unknown";
  const uptime = (typeof process.uptime === "function") ? Math.round(process.uptime()) : undefined;
  return res.status(200).json({
    ok: true,
    status: "healthy",
    meta: { service:"bags-shield-api", version:"1.0.0", env, time: now, requestId:_rid },
    checks: { uptimeSeconds: uptime }
  });
}