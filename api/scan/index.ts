import type { VercelRequest, VercelResponse } from "@vercel/node";

/* scan: monolithic + env-auth */
function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization,content-type,x-requested-with");
  res.setHeader("Access-Control-Max-Age", "86400");
}
function preflight(_req: VercelRequest, res: VercelResponse) { setCors(res); res.status(204).end(); }
function noStore(res: VercelResponse) { res.setHeader("Cache-Control","no-store"); }
function unauthorized(res: VercelResponse, msg="Missing or invalid Authorization: Bearer <token>") {
  setCors(res); noStore(res);
  res.status(401).json({ success:false, error:{ code:"UNAUTHORIZED", message: msg }});
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const method = (req.method || "GET").toUpperCase();
  if (method === "OPTIONS") return preflight(req, res);
  setCors(res);
  if (method !== "GET" && method !== "HEAD") { res.setHeader("Allow", "GET, HEAD, OPTIONS"); return res.status(405).json({ success:false, error:{ code:"METHOD_NOT_ALLOWED", message:"Use GET | OPTIONS" } }); }

  const auth = (req.headers?.authorization || (req.headers as any)?.Authorization) as string | undefined;
  const IS_PROD = (process.env.VERCEL_ENV === "production");
  const EXPECTED = process.env.BAGS_BEARER || (!IS_PROD ? "dev-123" : undefined);
  const token = (auth && auth.toLowerCase().startsWith("bearer ")) ? auth.slice(7).trim() : "";
  if (!EXPECTED?.trim() || token !== EXPECTED.trim()) return unauthorized(res);
  if (method === "HEAD") { noStore(res); return res.status(200).end(); }

  let query: Record<string, string> = {};
  try {
    const u = new URL(req.url || "", "https://dummy");
    u.searchParams.forEach((v,k)=>{ query[k]=v; });
  } catch {}

  noStore(res);
  return res.status(200).json({ success:true, response:{ note:"scan-ok", query }});
}