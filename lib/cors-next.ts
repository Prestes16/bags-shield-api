/**
 * CORS helpers para Next.js App Router (NextRequest/NextResponse)
 * Compatível com padrão v0
 */

import { NextRequest, NextResponse } from 'next/server';

export function setCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Expose-Headers', 'X-Request-Id');
  return res;
}

export function noStore(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export function newRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function guardMethod(req: NextRequest, allowed: string[]): { allowed: boolean; response?: NextResponse } {
  if (!req.method || !allowed.includes(req.method)) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'method_not_allowed',
          message: `Método permitido: ${allowed.join(', ')}`,
        },
        { status: 405 },
      ),
    };
  }
  return { allowed: true };
}

export function preflight(req: NextRequest): NextResponse | null {
  if (req.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 });
    setCors(res);
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Max-Age', '86400');
    return res;
  }
  return null;
}
