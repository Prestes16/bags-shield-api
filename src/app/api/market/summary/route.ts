/**
 * GET /api/market/summary?mint=...
 * Proxy para BAGS_SHIELD_API_BASE. Sempre retorna JSON.
 * Network errors → 502 com mensagem genérica (sem vazar target URL).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrGenerateRequestId } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const requestId = getOrGenerateRequestId(request.headers);
  const mint = request.nextUrl.searchParams.get('mint')?.trim();

  if (!mint) {
    return NextResponse.json(
      { success: false, error: 'Mint required (query param: ?mint=...)' },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
          'X-Request-Id': requestId,
        },
      },
    );
  }

  const base = process.env.BAGS_SHIELD_API_BASE?.trim();
  if (!base) {
    return NextResponse.json(
      { success: true, response: { mint, note: 'stub market summary (local)' } },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'X-Request-Id': requestId,
        },
      },
    );
  }

  const url = `${base.replace(/\/$/, '')}/api/market/summary?mint=${encodeURIComponent(mint)}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json().catch(() => null);

    if (data && typeof data.success !== 'undefined') {
      return NextResponse.json(
        res.ok
          ? { success: true, response: data.response ?? data }
          : { success: false, error: data.error ?? 'Market summary failed' },
        {
          status: res.ok ? 200 : res.status,
          headers: {
            'Cache-Control': 'no-store',
            'X-Request-Id': requestId,
          },
        },
      );
    }

    return NextResponse.json(
      { success: false, error: 'Invalid response from API' },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
          'X-Request-Id': requestId,
        },
      },
    );
  } catch {
    // ECONNREFUSED, fetch failed etc → 502 JSON, sem expor URL
    return NextResponse.json(
      { success: false, error: 'Market summary proxy unavailable.' },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
          'X-Request-Id': requestId,
        },
      },
    );
  }
}
