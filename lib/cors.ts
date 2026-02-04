import type { VercelRequest, VercelResponse } from '@vercel/node';

export function setCors(res: VercelResponse, _req: VercelRequest): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
}

export function noStore(res: VercelResponse): void {
  res.setHeader('Cache-Control', 'no-store');
}

export function ensureRequestId(res: VercelResponse): string {
  const existing = res.getHeader('X-Request-Id');
  if (existing && typeof existing === 'string') return existing;
  const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  res.setHeader('X-Request-Id', id);
  return id;
}

export function guardMethod(req: VercelRequest, res: VercelResponse, allowed: string[]): boolean {
  if (!req.method || !allowed.includes(req.method)) {
    res.status(405).json({
      success: false,
      error: 'method_not_allowed',
      message: `Método permitido: ${allowed.join(', ')}`,
    });
    return false;
  }
  return true;
}

export function preflight(res: VercelResponse, methods: string[], headers: string[], _req: VercelRequest): void {
  setCors(res, _req as VercelRequest);
  res.setHeader('Access-Control-Allow-Methods', methods.join(','));
  res.setHeader('Access-Control-Allow-Headers', headers.join(','));
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).end();
}
