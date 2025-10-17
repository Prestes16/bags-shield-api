import type { VercelRequest, VercelResponse } from "@vercel/node";

/* diag: monolith + try/catch */
function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization,content-type,x-requested-with");
  res.setHeader("Access-Control-Max-Age", "86400");
}
function preflight(_req: VercelRequest, res: VercelResponse) { setCors(res); res.status(204).end(); }
function noStore(res: VercelResponse) { res.setHeader("Cache-Control","no-store"); }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const method = (req.method || "GET").toUpperCase();
    if (method === "OPTIONS") return preflight(req, res);
    setCors(res);
    if (method !== "GET") { res.setHeader("Allow", "GET, OPTIONS"); return res.status(405).json({ success:false, error:{ code:"METHOD_NOT_ALLOWED", message:"Use GET | OPTIONS" } }); }

    let query: Record<string, string> = {};
    try {
      const u = new URL(req.url || "", "https://dummy");
      u.searchParams.forEach((v,k)=>{ query[k]=v; });
    } catch {}

    noStore(res);
    return res.status(200).json({ success:true, response:{ note:"scan-ok", query }});
  } catch (err: any) {
    setCors(res); noStore(res);
    const msg = err?.message || String(err);
    const stack = (err?.stack ? String(err.stack).split("\n").slice(0,6) : []);
    return res.status(500).json({ success:false, error:{ code:"INTERNAL", message: msg, stack }});
  }
}