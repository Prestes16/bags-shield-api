/**
 * GET /api/market/summary?mint=...
 * Proxy para BAGS_SHIELD_API_BASE. Mint é opcional:
 *  - Sem mint: retorna sumário geral de mercado (SOL price via Jupiter)
 *  - Com mint: proxy para upstream ou stub local
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

// Mint address do SOL (wrapped) para preço via Jupiter
const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Busca preço do SOL via Jupiter Price API v2.
 * Retorna null em caso de falha (não quebra a rota).
 */
async function fetchSolMarketData(): Promise<{ solPrice: number; volume24h: number | null } | null> {
  try {
    const res = await fetch(
      `https://api.jup.ag/price/v2?ids=${SOL_MINT}`,
      { cache: 'no-store', signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.data?.[SOL_MINT]?.price;
    if (!price) return null;
    return { solPrice: Number(price), volume24h: null };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const requestId = getOrGenerateRequestId(request.headers);
  const mint = request.nextUrl.searchParams.get('mint')?.trim();
  const base = process.env.BAGS_SHIELD_API_BASE?.trim();

  // --- Sem mint: retorna sumário geral de mercado ---
  if (!mint) {
    // Tenta upstream se configurado
    if (base) {
      try {
        const url = `${base.replace(/\/$/, '')}/api/market/summary`;
        const upstreamRes = await fetch(url, {
          cache: 'no-store',
          signal: AbortSignal.timeout(4000),
        });
        const data = await upstreamRes.json().catch(() => null);
        if (upstreamRes.ok && data) {
          return jsonResponse(
            request,
            { success: true, response: data.response ?? data },
            200,
            requestId,
          );
        }
      } catch { /* cai pro fallback */ }
    }

    // Fallback: busca SOL price direto do Jupiter
    const solData = await fetchSolMarketData();
    return jsonResponse(
      request,
      { success: true, response: solData ?? { note: 'market data unavailable' } },
      200,
      requestId,
    );
  }

  // --- Com mint: comportamento original (proxy ou stub) ---
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
