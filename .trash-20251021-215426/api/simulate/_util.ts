import type { VercelRequest, VercelResponse } from "@vercel/node";

export function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization,content-type,x-requested-with");
  res.setHeader("Access-Control-Max-Age", "86400");
}
export function preflight(_req: VercelRequest, res: VercelResponse) { setCors(res); res.status(204).end(); }
export function noStore(res: VercelResponse) { res.setHeader("Cache-Control", "no-store"); }
export function badRequest(res: VercelResponse, message: string) {
  setCors(res); noStore(res);
  res.status(400).json({ ok:false, error:{ code:"BAD_REQUEST", message }, meta:{ service:"bags-shield-api", version:"1.0.0", time:new Date().toISOString() }});
}
export function unauthorized(res: VercelResponse, message="Missing or invalid Authorization: Bearer <token>") {
  setCors(res); noStore(res);
  res.status(401).json({ success:false, error:{ code:"UNAUTHORIZED", message }});
}
export function methodNotAllowed(res: VercelResponse, allow: string[]) {
  setCors(res); noStore(res);
  res.setHeader("Allow", allow.join(", "));
  res.status(405).json({ success:false, error:{ code:"METHOD_NOT_ALLOWED", message:`Use ${allow.join(" | ")}` }});
}
export async function readBody(req: any): Promise<any|null> {
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
    txt = txt.trim();
    if (!txt) return null;
    if (ct.toLowerCase().includes("application/x-www-form-urlencoded")) {
      const p=new URLSearchParams(txt); const obj:Record<string,string>={}; for(const [k,v] of p.entries()) obj[k]=v; return obj;
    }
    try { return JSON.parse(txt); } catch { return null; }
  } catch {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve,reject)=>{ const onData=(c:any)=>{try{chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c));}catch(e){cleanup();reject(e);} };
      const onEnd=()=>{cleanup();resolve()}; const onErr=(e:any)=>{cleanup();reject(e||new Error("stream error"))};
      const cleanup=()=>{req.removeListener?.('data',onData);req.removeListener?.('end',onEnd);req.removeListener?.('error',onErr);req.removeListener?.('aborted',onErr);};
      req.on('data',onData);req.on('end',onEnd);req.on('error',onErr);req.on('aborted',onErr);
    });
    if (!chunks.length) return null;
    const txt = Buffer.concat(chunks).toString("utf8").trim();
    if (!txt) return null;
    try { return JSON.parse(txt); } catch { return null; }
  }
}