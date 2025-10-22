import type { VercelRequest, VercelResponse } from "@vercel/node";

/* simulate: monolithic + env-auth + X-Request-Id */
function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
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
function badRequest(res: VercelResponse, message: string) {
  setCors(res); const rid = newRequestId(res); noStore(res);
  res.status(400).json({ ok:false, error:{ code:"BAD_REQUEST", message },
    meta:{ service:"bags-shield-api", version:"1.0.0", time:new Date().toISOString(), requestId: rid }});
}
function unauthorized(res: VercelResponse, msg="Missing or invalid Authorization: Bearer <token>") {
  setCors(res); const rid = newRequestId(res); noStore(res);
  res.status(401).json({ ok:false, error:{ code:"UNAUTHORIZED", message: msg },
    meta:{ service:"bags-shield-api", version:"1.0.0", time:new Date().toISOString(), requestId: rid }});
}
function methodNotAllowed(res: VercelResponse, allow: string[]) {
  setCors(res); const rid = newRequestId(res); noStore(res);
  res.setHeader("Allow", allow.join(", "));
  res.status(405).json({ ok:false, error:{ code:"METHOD_NOT_ALLOWED", message:`Use ${allow.join(" | ")}` },
    meta:{ service:"bags-shield-api", version:"1.0.0", time:new Date().toISOString(), requestId: rid }});
}
async function readBody(req: any): Promise<any|null> {
  const ct = String(req?.headers?.["content-type"] || "");
  if (req && "body" in req) {
    const b = (req as any).body;
    if (b === null || b === undefined) return null;
    if (typeof b === "object") return b;
    if (typeof b === "string") { const t=b.trim(); if (!t) return null; try { return JSON.parse(t); } catch {} }
  }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req as any) chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
    if (!chunks.length) return null;
    let txt = Buffer.concat(chunks).toString("utf8");
    if (txt.charCodeAt(0)===0xFEFF) txt = txt.slice(1);
    txt = txt.trim(); if (!txt) return null;
    if (ct.toLowerCase().includes("application/x-www-form-urlencoded")) {
      const p=new URLSearchParams(txt); const obj:Record<string,string>={}; for(const [k,v] of p.entries()) obj[k]=v; return obj;
    }
    try { return JSON.parse(txt); } catch { return null; }
  } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const method = (req.method || "POST").toUpperCase();
  if (method === "OPTIONS") return preflight(req, res);
  setCors(res); const _rid = newRequestId(res);
  if (method !== "POST") return methodNotAllowed(res, ["POST","OPTIONS"]);

  const auth = (req.headers?.authorization || (req.headers as any)?.Authorization) as string | undefined;
  const IS_PROD = (process.env.VERCEL_ENV === "production");
  const EXPECTED_RAW = process.env.BAGS_BEARER || (!IS_PROD ? "dev-123" : undefined);
  const EXPECTED = EXPECTED_RAW?.trim();
  const token = (auth && auth.toLowerCase().startsWith("bearer ")) ? auth.slice(7).trim() : "";
  if (!EXPECTED || token !== EXPECTED) return unauthorized(res);

  const body = await readBody(req as any);
  if (!body) return badRequest(res, "JSON body obrigatório");

  noStore(res);
  return res.status(200).json({
    ok:true,
    response:{ note:"simulate-ok", received: body },
    meta:{ service:"bags-shield-api", version:"1.0.0", time:new Date().toISOString(), requestId:_rid }
  });
}