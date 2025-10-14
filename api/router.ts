/**
 * Bags Shield — Router unificado (versão self-contained)
 * Remove imports externos para evitar falhas ESM no runtime.
 */

type Res = any; type Req = any;

// --- CORS minimalista (inline) ---
function setCors(res: Res) {
  const allow = process.env.CORS_ALLOW || "*";
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-api-key");
  res.setHeader("Vary", "Origin");
}
function preflight(res: Res) {
  setCors(res);
  res.statusCode = 204;
  res.setHeader("Content-Length", "0");
  res.end();
}
function noStore(res: Res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}
function guardMethod(req: Req, res: Res, allowed: string[]) {
  if (!allowed.includes(req.method)) {
    res.setHeader("Allow", allowed.join(", "));
    json(res, 405, { success: false, error: "Method Not Allowed", allow: allowed });
    return false;
  }
  return true;
}

// --- Helpers HTTP ---
const json = (res: Res, status: number, body: unknown) => {
  noStore(res);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};
const text = (res: Res, status: number, body: string) => {
  noStore(res);
  res.statusCode = status;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.end(body);
};

// --- JSON body reader ---
class JsonParseError extends Error { raw: string; constructor(raw: string) { super("Invalid JSON"); this.raw = raw; } }
async function readJson(req: Req) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (!chunks.length) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { throw new JsonParseError(raw); }
}

// --- ENV/Upstream helpers ---
const BASE = process.env.BAGS_API_BASE ?? "";
const TIMEOUT_MS = Math.max(100, Number(process.env.BAGS_TIMEOUT_MS ?? "5000"));
function stdHeaders() {
  const key = process.env.BAGS_API_KEY ?? "";
  const h: Record<string, string> = { accept: "application/json" };
  if (key) { h["x-api-key"] = key; h["authorization"] = `Bearer ${key}`; }
  return h;
}
function abortableTimeout(ms: number) {
  const controller = new AbortController(); const t = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(t) };
}
async function fetchWithTimeout(input: string, init: RequestInit = {}) {
  const { signal, cancel } = abortableTimeout(TIMEOUT_MS);
  try { return await fetch(input, { ...init, signal }); } finally { cancel(); }
}
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
function isMintLike(s: string) { return BASE58_RE.test(s); }

async function upstreamCreators(mint: string) {
  if (!BASE) return [] as string[];
  const url = `${BASE.replace(/\/$/, "")}/creators?mint=${encodeURIComponent(mint)}`;
  const r = await fetchWithTimeout(url, { headers: stdHeaders() });
  if (!r.ok) return [];
  const data = await r.json().catch(() => ({}));
  return (data as any)?.response ?? data ?? [];
}
type FeesOut = { lamports: number; sol: number };
async function upstreamLifetimeFees(mint: string): Promise<FeesOut> {
  if (!BASE) return { lamports: 0, sol: 0 };
  const url = `${BASE.replace(/\/$/, "")}/lifetime-fees?mint=${encodeURIComponent(mint)}`;
  const r = await fetchWithTimeout(url, { headers: stdHeaders() });
  if (!r.ok) return { lamports: 0, sol: 0 };
  const data: any = await r.json().catch(() => ({}));
  const raw = typeof data === "number" ? data : typeof data?.response === "number" ? data.response : Number(data?.lamports ?? 0);
  const lamports = Number.isFinite(raw) ? Number(raw) : 0;
  return { lamports, sol: lamports / 1_000_000_000 };
}

// --- Handler principal ---
export default async function handler(req: Req, res: Res) {
  if (req.method === "OPTIONS") return preflight(res);
  setCors(res);

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = url.pathname;
    const rewritePath = url.searchParams.get("path");
    if (rewritePath) { try { pathname = decodeURIComponent(rewritePath); } catch { pathname = rewritePath; } }

    // /api/health
    if (pathname === "/api/health") {
      if (!guardMethod(req, res, ["GET"])) return;
      return json(res, 200, { success: true, response: { status: "ok", ts: new Date().toISOString(), env: process.env.BAGS_ENV ?? "unknown" } });
    }

    // /api/token/:mint/creators
    if (pathname.startsWith("/api/token/") && pathname.endsWith("/creators")) {
      if (!guardMethod(req, res, ["GET"])) return;
      const parts = pathname.split("/").filter(Boolean);
      const mint = decodeURIComponent(parts[2] ?? url.searchParams.get("mint") ?? "");
      if (!isMintLike(mint)) return json(res, 400, { success: false, error: "Invalid mint (expected base58 32–44 chars)" });
      const creators = await upstreamCreators(mint);
      return json(res, 200, { success: true, response: creators });
    }

    // /api/token/:mint/lifetime-fees
    if (pathname.startsWith("/api/token/") && pathname.endsWith("/lifetime-fees")) {
      if (!guardMethod(req, res, ["GET"])) return;
      const parts = pathname.split("/").filter(Boolean);
      const mint = decodeURIComponent(parts[2] ?? url.searchParams.get("mint") ?? "");
      if (!isMintLike(mint)) return json(res, 400, { success: false, error: "Invalid mint (expected base58 32–44 chars)" });
      const fees = await upstreamLifetimeFees(mint);
      return json(res, 200, { success: true, response: fees });
    }

    // placeholders
    if (pathname === "/api/scan" || pathname === "/api/simulate" || pathname === "/api/apply") {
      return json(res, 501, { success: false, error: "Router: endpoint ainda não migrado. Use as rotas atuais diretamente." });
    }

    return json(res, 404, { success: false, error: "Not Found" });
  } catch (err: any) {
    if (err instanceof JsonParseError) {
      return json(res, 400, { success: false, error: "Invalid JSON", issues: [{ code: "invalid_json", message: "Body is not valid JSON", raw: err.raw?.slice(0,256) }] });
    }
    return json(res, 500, { success: false, error: "Internal Error", detail: (err && err.message) || String(err) });
  }
}
