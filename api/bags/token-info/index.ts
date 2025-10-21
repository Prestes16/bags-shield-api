export const config = { runtime: "nodejs" };

import { getTokenInfo } from "../../../lib/bags";

function baseHeaders(requestId: string) {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "authorization,content-type,x-requested-with",
    "Access-Control-Expose-Headers": "X-Request-Id",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Request-Id": requestId,
  });
}

function meta(requestId: string) {
  return { service: "bags-shield-api", version: "1.0.0", time: new Date().toISOString(), requestId };
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const requestId = (globalThis.crypto && "randomUUID" in globalThis.crypto) ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2);
  const headers = baseHeaders(requestId);

  if (method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (method === "HEAD")    return new Response(null, { status: 200, headers });
  if (method !== "GET") {
    const body = JSON.stringify({ ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET" }, meta: meta(requestId) });
    return new Response(body, { status: 405, headers });
  }

  const mint = url.searchParams.get("mint")?.trim() || "";
  if (!mint) {
    const body = JSON.stringify({ ok: false, error: { code: "BAD_REQUEST", message: "ParÃ¢metro mint Ã© obrigatÃ³rio" }, meta: meta(requestId) });
    return new Response(body, { status: 400, headers });
  }

  try {
    const upstream = await getTokenInfo(mint);
    const m = meta(requestId) as any;
    m.upstreamRequestId = (upstream as any)?.upstreamRequestId ?? (upstream as any)?.data?.meta?.requestId ?? null;

    if ((upstream as any).ok) {
      const payload = (upstream as any).data?.response ?? (upstream as any).data?.data ?? (upstream as any).data;
      const body = JSON.stringify({ ok: true, data: { mint, info: payload }, meta: m });
      return new Response(body, { status: 200, headers });
    } else {
      const status = (upstream as any).status ?? 502;
      const errObj = (upstream as any).data?.error ?? { code: "UPSTREAM_ERROR" };
      const body = JSON.stringify({ ok: false, error: errObj, meta: m });
      return new Response(body, { status, headers });
    }
  } catch (err: any) {
    const body = JSON.stringify({ ok: false, error: { code: "UPSTREAM_FETCH_FAILED", message: String(err?.message || err) }, meta: meta(requestId) });
    return new Response(body, { status: 502, headers });
  }
}

