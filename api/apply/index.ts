import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";

/* apply: CORS + no-store + try/catch + readBody + idem-cache + Zod + auth ENV + X-Request-Id */

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos
type ApplyData = {
  id: string;
  idempotencyKey?: string;
  mint: string;
  network: "devnet" | "testnet" | "mainnet";
  action: string;
  reason?: string;
  params: Record<string, any>;
  result: "applied";
  effects: { state: string; severity: string };
};

// cache global v0
const G: any = globalThis as any;
if (!G.__bags_idem) G.__bags_idem = new Map<string, { ts: number; data: ApplyData }>();
const idemStore: Map<string, { ts: number; data: ApplyData }> = G.__bags_idem;

// Zod
const ApplySchema = z.object({
  mint: z.string().min(1, "mint obrigatório"),
  network: z.enum(["devnet","testnet","mainnet"]).default("devnet"),
  action: z.string().min(1, "action obrigatório"),
  reason: z.string().optional(),
  idempotencyKey: z.string().uuid("idempotencyKey deve ser UUID").optional(),
  params: z.record(z.any()).optional()
});

// utils
function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization,content-type,x-requested-with");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
}
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
function badRequest(res: VercelResponse, message: string, details?: any[]) {
  setCors(res); const rid = newRequestId(res); noStore(res);
  res.status(400).json({ ok:false, error:{ code:"BAD_REQUEST", message, details },
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

function sweepIdem() {
  const now = Date.now();
  if (idemStore.size > 256) for (const [k, v] of idemStore) if (now - v.ts > CACHE_TTL_MS) idemStore.delete(k);
}
function getIdem(key?: string): ApplyData | null {
  if (!key) return null;
  const entry = idemStore.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { idemStore.delete(key); return null; }
  return entry.data;
}
function putIdem(key: string | undefined, data: ApplyData) {
  if (!key) return;
  sweepIdem();
  idemStore.set(key, { ts: Date.now(), data });
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
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const method = (req.method || "POST").toUpperCase();
    if (method === "OPTIONS") { setCors(res); newRequestId(res); return res.status(204).end(); }
    setCors(res); const _rid = newRequestId(res);
    if (method !== "POST") return methodNotAllowed(res, ["POST","OPTIONS"]);

    // Auth via ENV
    const auth = (req.headers?.authorization || (req.headers as any)?.Authorization) as string | undefined;
    const IS_PROD = (process.env.VERCEL_ENV === "production");
    const EXPECTED_RAW = process.env.BAGS_BEARER || (!IS_PROD ? "dev-123" : undefined);
    const EXPECTED = EXPECTED_RAW?.trim();
    const token = (auth && auth.toLowerCase().startsWith("bearer ")) ? auth.slice(7).trim() : "";
    if (!EXPECTED || token !== EXPECTED) return unauthorized(res);

    const body = await readBody(req as any);
    if (!body) return badRequest(res, "JSON body obrigatório");

    const parsed = ApplySchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues.map(i => ({ path: i.path.join("."), message: i.message, code: i.code }));
      return badRequest(res, "Payload inválido", details);
    }
    const { mint, network, action, reason, idempotencyKey, params } = parsed.data;

    const cached = getIdem(idempotencyKey);
    if (cached) {
      noStore(res);
      return res.status(200).json({
        ok: true,
        data: cached,
        meta: { service:"bags-shield-api", version:"1.0.0", time:new Date().toISOString(), idempotent:true, requestId:_rid }
      });
    }

    const id = "act_" + Math.random().toString(36).slice(2, 16);
    const effects = { state: action === "flag" ? "flagged" : "updated", severity: action === "flag" ? "medium" : "low" };
    const data: ApplyData = { id, idempotencyKey, mint, network, action, reason, params: params ?? {}, result: "applied", effects };

    putIdem(idempotencyKey, data);

    noStore(res);
    return res.status(200).json({
      ok: true,
      data,
      meta: { service:"bags-shield-api", version:"1.0.0", time:new Date().toISOString(), idempotent:false, requestId:_rid }
    });
  } catch (err: any) {
    setCors(res); const rid = newRequestId(res); noStore(res);
    const msg = err?.message || String(err);
    const stack = (err?.stack ? String(err.stack).split("\n").slice(0,6) : []);
    return res.status(500).json({ ok:false, error:{ code:"INTERNAL", message: msg, stack },
      meta:{ service:"bags-shield-api", version:"1.0.0", time:new Date().toISOString(), requestId: rid }});
  }
}