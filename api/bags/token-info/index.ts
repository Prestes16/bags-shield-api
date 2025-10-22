export const config = { runtime: "nodejs" };

import { getTokenInfo } from "../../../lib/bags.js";

function setBaseHeaders(res: any, requestId: string) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization,content-type,x-requested-with");
  res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Request-Id", requestId);
}

function meta(requestId: string, extra: Record<string,unknown> = {}) {
  return { service: "bags-shield-api", version: "1.0.0", time: new Date().toISOString(), requestId, ...extra };
}

function resolveBase(): string | undefined {
  const raw = (process.env.BAGS_API_BASE_OVERRIDE ?? process.env.BAGS_API_BASE ?? '').trim();
  if (!raw) return undefined;
  return raw.replace(/\/_mock\b/, '/mock').trim();
}

export default async function handler(req: any, res: any) {
  const method = String(req.method || "").toUpperCase();
  const requestId = (globalThis.crypto && "randomUUID" in globalThis.crypto) ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2);
  setBaseHeaders(res, requestId);

  if (method === "OPTIONS") { res.status(204).end(); return; }
  if (method === "HEAD")    { res.status(200).end(); return; }
  if (method !== "GET") {
    res.status(405).send(JSON.stringify({ ok:false, error:{ code:"METHOD_NOT_ALLOWED", message:"Use GET" }, meta: meta(requestId) }));
    return;
  }

  const u = new URL(String(req.url || "/"), "http://local");
  const mint = (u.searchParams.get("mint") || "").trim();
  if (!mint) {
    res.status(400).send(JSON.stringify({ ok:false, error:{ code:"BAD_REQUEST", message:"Parameter mint is required" }, meta: meta(requestId) }));
    return;
  }

  const base = resolveBase();
  try {
    const upstream: any = await getTokenInfo(mint, { baseUrl: base, timeoutMs: Number(process.env.BAGS_TIMEOUT_MS || "5000") || 5000, apiKey: process.env.BAGS_API_KEY || undefined });
    const m: any = meta(requestId, { baseUrlUsed: base ?? null, upstreamRequestId: upstream?.upstreamRequestId ?? upstream?.data?.meta?.requestId ?? null });
    if (upstream && upstream.ok) {
      const payload = upstream.data?.response ?? upstream.data?.data ?? upstream.data;
      res.status(200).send(JSON.stringify({ ok:true, data:{ mint, info: payload }, meta: m }));
    } else {
      const status = upstream?.status ?? 502;
      const errObj = upstream?.data?.error ?? { code: "UPSTREAM_ERROR" };
      res.status(status).send(JSON.stringify({ ok:false, error: errObj, meta: m }));
    }
  } catch (err: any) {
    res.status(502).send(JSON.stringify({ ok:false, error:{ code:"UPSTREAM_FETCH_FAILED", message:String(err?.message || err) }, meta: meta(requestId, { baseUrlUsed: base ?? null }) }));
  }
}
