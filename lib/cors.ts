import type { VercelRequest, VercelResponse } from "@vercel/node";

function isDev() {
  const env = (process.env.NODE_ENV || "development").toLowerCase();
  return env !== "production";
}

/**
 * Resolve a origem permitida:
 * - Se CORS_ALLOW estiver setado, usa o valor literal (pode ser * ou lista separada por vírgula)
 * - Senão: em dev -> http://localhost:5173; em prod -> vazio (CORS fechado por padrão)
 */
export function resolveCorsAllow(reqOrigin?: string): string | undefined {
  const fromEnv = process.env.CORS_ALLOW?.trim();
  if (fromEnv) {
    // permite lista separada por vírgula; escolhe a que bate com o Origin do request, senão cai no primeiro item
    if (fromEnv.includes(",")) {
      const list = fromEnv.split(",").map(s => s.trim()).filter(Boolean);
      if (reqOrigin && list.includes(reqOrigin)) return reqOrigin;
      return list[0];
    }
    return fromEnv;
  }
  // fallback por ambiente
  return isDev() ? "http://localhost:5173" : undefined;
}

export function applyCors(req: VercelRequest, res: VercelResponse) {
  const origin = resolveCorsAllow(req.headers?.origin as string | undefined);
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
}

export function preflight(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    applyCors(req, res);
    return res.status(204).end();
  }
  return null;
}
