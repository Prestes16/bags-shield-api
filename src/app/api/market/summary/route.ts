/**
 * GET /api/market/summary?mint=...
 * Proxy para BAGS_SHIELD_API_BASE. Sempre retorna JSON.
 * Network errors -> 502 com mensagem generica (sem vazar target URL).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getOrGenerateRequestId,
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
} from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  applyCorsHeaders(request, response);
  applyNoStore(response);
  applySecurityHeaders(response);
  response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  return response;
}

function jsonResponse(
  request: NextRequest,
  body: unknown,
  status: number,
  requestId: string,
) {
  const response = NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Request-Id': requestId,
    },
  });
  applyCorsHeaders(request, response);
  applyNoStore(response);
  applySecurityHeaders(response);
  return response;
}

export async function GET(request: NextRequest) {
  const requestId = getOrGenerateRequestId(request.headers);
  const mint = request.nextUrl.searchParams.get('mint')?.trim();

  if (!mint) {
    return jsonResponse(
      request,
      { success: false, error: 'Mint required (query param: ?mint=...)' },
      400,
      requestId,
    );
  }

  const base = process.env.BAGS_SHIELD_API_BASE?.trim();
  if (!base) {
    return jsonResponse(
      request,
      { success: true, response: { mint, note: 'stub market summary (local)' } },
      200,
      requestId,
    );
  }

  const url = `${base.replace(/\/$/, '')}/api/market/summary?mint=${encodeURIComponent(mint)}`;

  try {
    const upstreamRes = await fetch(url, { cache: 'no-store' });
    const data = await upstreamRes.json().catch(() => null);

    if (data && typeof data.success !== 'undefined') {
      return jsonResponse(
        request,
        upstreamRes.ok
          ? { success: true, response: data.response ?? data }
          : { success: false, error: data.error ?? 'Market summary failed' },
        upstreamRes.ok ? 200 : upstreamRes.status,
        requestId,
      );
    }

    return jsonResponse(
      request,
      { success: false, error: 'Invalid response from API' },
      502,
      requestId,
    );
  } catch {
    return jsonResponse(
      request,
      { success: false, error: 'Market summary proxy unavailable.' },
      502,
      requestId,
    );
  }
}
