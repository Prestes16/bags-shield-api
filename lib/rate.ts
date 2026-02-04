import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Rate limit middleware. Retorna true para continuar, false se bloqueou.
 * Só ativo se RATE_LIMIT_* estiver configurado.
 */
export function rateLimitMiddleware(req: VercelRequest, res: VercelResponse): boolean {
  const limit = process.env.RATE_LIMIT_MAX;
  const windowMs = process.env.RATE_LIMIT_WINDOW_MS;
  if (!limit || !windowMs) return true;
  // Stub: sem store em memória por função serverless; em produção usar Redis ou similar
  return true;
}
