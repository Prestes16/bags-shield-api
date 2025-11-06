/**
 * Config central do Bags Shield (Node 20 / ESM).
 * Mantém defaults seguros para ambiente local/canário.
 */

export const IS_PROD =
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production";

function toInt(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
}

export const CONFIG = {
  // Base de chamadas ao upstream Bags. Ex.: https://public-api-v2.bags.fm/api/v1/
  BAGS_API_BASE: (process.env.BAGS_API_BASE || "").trim(),

  // Chave da Bags (x-api-key e também Authorization: Bearer <key>)
  BAGS_API_KEY: (process.env.BAGS_API_KEY || "").trim(),

  // Timeouts e retries (canário)
  BAGS_TIMEOUT_MS: toInt(process.env.BAGS_TIMEOUT_MS, 5000),
  BAGS_RETRIES: toInt(process.env.BAGS_RETRIES, 2),
  BAGS_BACKOFF_MS_MIN: toInt(process.env.BAGS_BACKOFF_MS_MIN, 200),
  BAGS_BACKOFF_MS_MAX: toInt(process.env.BAGS_BACKOFF_MS_MAX, 1200),

  // Identidade opcional do deployment (para logs/headers)
  DEPLOYMENT_ID: (process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || "").trim(),
} as const;

/**
 * Helper simples para validar envs críticas quando necessário.
 * Use apenas em rotas/admin onde falhar cedo é desejável.
 */
export function ensureEnv(name: keyof typeof CONFIG): string {
  const v = CONFIG[name];
  if (!v) throw new Error(`Missing required env: ${String(name)}`);
  return String(v);
}