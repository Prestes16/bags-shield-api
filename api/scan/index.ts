import type { VercelRequest, VercelResponse } from "@vercel/node";

/* scan: monolithic + env-auth + X-Request-Id + HEAD */
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
function unauthorized(res: VercelResponse, msg="Missing or invalid Authorization: Bearer <token>") {
  setCors(res); const rid = newRequestId(res); noStore(res);
  res.status(401).json({ ok:false, error:{ code:"UNAUTHORIZED", message: msg },
    meta:{ service:"bags-shield-api", version:"1.0.0", time:new Date().toISOString(), requestId: rid }});
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const method = (req.method || "GET").toUpperCase();
  if (method === "OPTIONS") return preflight(req, res);
  setCors(res); const _rid = newRequestId(res);
  if (method !== "GET" && method !== "HEAD") { res.setHeader("Allow", "GET, HEAD, OPTIONS"); noStore(res);
    return res.status(405).json({ ok:false, error:{ code:"METHOD_NOT_ALLOWED", message:"Use GET | HEAD | OPTIONS" },
      meta:{ service:"bags-shield-api", version:"1.0.0", time:new Date().toISOString(), requestId:_rid }});
  }

  const auth = (req.headers?.authorization || (req.headers as any)?.Authorization) as string | undefined;
  const IS_PROD = (process.env.VERCEL_ENV === "production");
  const EXPECTED_RAW = process.env.BAGS_BEARER || (!IS_PROD ? "dev-123" : undefined);
  const EXPECTED = EXPECTED_RAW?.trim();
  const token = (auth && auth.toLowerCase().startsWith("bearer ")) ? auth.slice(7).trim() : "";
  if (!EXPECTED || token !== EXPECTED) return unauthorized(res);

  if (method === "HEAD") { noStore(res); return res.status(200).end(); }

  let query: Record<string, string> = {};
  try { const u = new URL(req.url || "", "https://dummy"); u.searchParams.forEach((v,k)=>{ query[k]=v; }); } catch {}

  noStore(res);
  return res.status(200).json({
    ok:true,
    response:{ note:"scan-ok", query },
    meta:{ service:"bags-shield-api", version:"1.0.0", time:new Date().toISOString(), requestId:_rid }
  });
}