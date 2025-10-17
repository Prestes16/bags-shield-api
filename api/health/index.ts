import type { VercelRequest, VercelResponse } from "@vercel/node";

/* health: monolithic + CORS + no-store + HEAD */
 param($m)
        $body = $m.Groups[1].Value
        if ($body -notmatch 'Access-Control-Expose-Headers') {
          $body += "`r`n  res.setHeader(""Access-Control-Expose-Headers"", ""X-Request-Id"");`r`n"
        }
        $body + "}"
      
function preflight(_req: VercelRequest, res: VercelResponse) { setCors(res);
    const _rid = newRequestId(res);
    res.status(204).end(); }
function noStore(res: VercelResponse) { res.setHeader("Cache-Control","no-store"); }


function newRequestId(res: VercelResponse) {
  let rid = "";
  try { rid = (globalThis as any).crypto?.randomUUID?.() || ""; } catch {}
  if (!rid) rid = "req_" + Math.random().toString(36).slice(2,10) + "_" + Date.now().toString(36);
  res.setHeader("X-Request-Id", rid);
  return rid;
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const method = (req.method || "GET").toUpperCase();
  if (method === "OPTIONS") return preflight(req, res);
  setCors(res);
    const _rid = newRequestId(res);
    // HEAD curto-circuito (200 sem corpo)
  if (method === "HEAD") { noStore(res); return res.status(200).end(); }

  if (method !== "GET") {
    res.setHeader("Allow","GET, HEAD, OPTIONS");
    return res.status(405).json({ ok:false, error:{ code:"METHOD_NOT_ALLOWED", message:"Use GET | HEAD | OPTIONS" } });
  }

  noStore(res);
  const now = new Date().toISOString();
  const env = process.env.VERCEL_ENV || "unknown";
  const uptime = (typeof process.uptime === "function") ? Math.round(process.uptime()) : undefined;
  return res.status(200).json({
    ok: true,
    status: "healthy",
    meta: { service:"bags-shield-api", version:"1.0.0", env, time: now },
    checks: { uptimeSeconds: uptime }
  });
}