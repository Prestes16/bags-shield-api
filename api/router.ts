import { setCors, preflight, guardMethod, noStore } from "../lib/cors";

// Helpers
const json = (res: any, status: number, body: unknown) => {
  noStore(res);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const text = (res: any, status: number, body: string) => {
  noStore(res);
  res.statusCode = status;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.end(body);
};

class JsonParseError extends Error {
  raw: string;
  constructor(raw: string) {
    super("Invalid JSON");
    this.raw = raw;
  }
}

async function readJson(req: any) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new JsonParseError(raw);
  }
}

const BASE = process.env.BAGS_API_BASE ?? "";
const TIMEOUT_MS = Math.max(100, Number(process.env.BAGS_TIMEOUT_MS ?? "5000"));

function stdHeaders() {
  const key = process.env.BAGS_API_KEY ?? "";
  const h: Record<string, string> = { accept: "application/json" };
  if (key) {
    h["x-api-key"] = key;
    h["authorization"] = `Bearer ${key}`;
  }
  return h;
}

function abortableTimeout(ms: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(t) };
}

async function fetchWithTimeout(input: string, init: RequestInit = {}) {
  const { signal, cancel } = abortableTimeout(TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal });
  } finally {
    cancel();
  }
}

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
function isMintLike(s: string) {
  return BASE58_RE.test(s);
}

// === Upstreams (com fallback seguro quando BASE vazio) ===
async function upstreamCreators(mint: string) {
  if (!BASE) return [] as string[];
  const url = `${BASE.replace(/\/$/, "")}/creators?mint=${encodeURIComponent(mint)}`;
  const r = await fetchWithTimeout(url, { headers: stdHeaders() });
  if (!r.ok) return [];
  const data = await r.json().catch(() => ({}));
  // Aceita {success,response} ou lista direta
  return (data?.response ?? data ?? []) as string[];
}

type FeesOut = { lamports: number; sol: number };
async function upstreamLifetimeFees(mint: string): Promise<FeesOut> {
  if (!BASE) return { lamports: 0, sol: 0 };
  const url = `${BASE.replace(/\/$/, "")}/lifetime-fees?mint=${encodeURIComponent(mint)}`;
  const r = await fetchWithTimeout(url, { headers: stdHeaders() });
  if (!r.ok) return { lamports: 0, sol: 0 };
  const data = await r.json().catch(() => ({}));
  // Aceita {lamports, sol} | {response:number} | number
  const raw =
    typeof data === "number"
      ? data
      : typeof (data as any)?.response === "number"
      ? (data as any).response
      : Number((data as any)?.lamports ?? 0);
  const lamports = Number.isFinite(raw) ? Number(raw) : 0;
  const sol = lamports / 1_000_000_000;
  return { lamports, sol };
}

// === Handler principal ===
export default async function handler(req: any, res: any) {
  // Preflight
  if (req.method === "OPTIONS") return preflight(res);

  // CORS + no-store por padrão
  setCors(res);

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const { pathname } = url;

    // /api/health  (GET)
    if (pathname === "/api/health") {
      guardMethod(req, res, ["GET"]);
      return json(res, 200, {
        success: true,
        response: {
          status: "ok",
          ts: new Date().toISOString(),
          env: process.env.BAGS_ENV ?? "unknown",
        },
      });
    }

    // /api/token/:mint/creators  (GET)
    if (pathname.startsWith("/api/token/") && pathname.endsWith("/creators")) {
      guardMethod(req, res, ["GET"]);
      const parts = pathname.split("/").filter(Boolean); // ['api','token',':mint','creators']
      const mint = decodeURIComponent(parts[2] ?? "");
      if (!isMintLike(mint)) {
        return json(res, 400, { success: false, error: "Invalid mint (expected base58 32–44 chars)" });
      }
      const creators = await upstreamCreators(mint);
      return json(res, 200, { success: true, response: creators });
    }

    // /api/token/:mint/lifetime-fees  (GET)
    if (pathname.startsWith("/api/token/") && pathname.endsWith("/lifetime-fees")) {
      guardMethod(req, res, ["GET"]);
      const parts = pathname.split("/").filter(Boolean); // ['api','token',':mint','lifetime-fees']
      const mint = decodeURIComponent(parts[2] ?? "");
      if (!isMintLike(mint)) {
        return json(res, 400, { success: false, error: "Invalid mint (expected base58 32–44 chars)" });
      }
      const fees = await upstreamLifetimeFees(mint);
      return json(res, 200, { success: true, response: fees });
    }

    // (Reservado) /api/scan | /api/simulate | /api/apply
    if (pathname === "/api/scan" || pathname === "/api/simulate" || pathname === "/api/apply") {
      return json(res, 501, {
        success: false,
        error: "Router: endpoint ainda não migrado. Use as rotas atuais diretamente.",
      });
    }

    // 404 padrão
    return json(res, 404, { success: false, error: "Not Found" });
  } catch (err: any) {
    if (err instanceof JsonParseError) {
      return json(res, 400, {
        success: false,
        error: "Invalid JSON",
        issues: [{ code: "invalid_json", message: "Body is not valid JSON", raw: err.raw.slice(0, 256) }],
      });
    }
    // Fallback 500
    return json(res, 500, {
      success: false,
      error: "Internal Error",
      detail: (err && err.message) || String(err),
    });
  }
}
