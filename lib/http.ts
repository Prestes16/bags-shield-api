import type { VercelResponse } from '@vercel/node';

export function badRequest(res: VercelResponse, message: string, requestId?: string): void {
  res.status(400).json({
    success: false,
    error: 'bad_request',
    message,
    meta: requestId ? { requestId } : undefined,
  });
}

export function unauthorized(res: VercelResponse, message: string, requestId?: string): void {
  res.status(401).json({
    success: false,
    error: 'unauthorized',
    message,
    meta: requestId ? { requestId } : undefined,
  });
}

export function ok(res: VercelResponse, data: unknown, requestId?: string, meta?: Record<string, unknown>): void {
  res.status(200).json({
    success: true,
    response: data,
    meta: requestId ? { requestId, ...meta } : meta,
  });
}
