/**
 * GET /api/price?ids=mint1,mint2,...
 *
 * Proxy server-side para https://api.jup.ag/price/v2
 * O browser não pode chamar a Jupiter Price API diretamente (CORS bloqueado).
 * Esta rota recebe os mint IDs, busca no servidor (sem restrição de CORS)
 * e devolve o JSON ao cliente.
 *
 * Parâmetros:
 *   ids   — lista separada por vírgula de mint addresses (obrigatório)
 *
 * Resposta de sucesso (espelha o shape da Jupiter Price API v2):
 *   { data: { [mint]: { id, mintSymbol, vsToken, vsTokenSymbol, price, ... } }, timeTaken: number }
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

const JUPITER_PRICE_URL = 'https://api.jup.ag/price/v2';
const JUPITER_API_KEY = (process.env.JUPITER_API_KEY ?? '').trim();
const TIMEOUT_MS = 5_000;
const MAX_IDS = 100;

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  applyCorsHeaders(request, response);
  applyNoStore(response);
  applySecurityHeaders(response);
  response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  return response;
}

function jsonResponse(request: NextRequest, body: unknown, status: number, requestId: string) {
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
  const { searchParams } = new URL(request.url);

  const rawIds = searchParams.get('ids') ?? '';
  if (!rawIds.trim()) {
    return jsonResponse(
      request,
      { success: false, error: 'MISSING_IDS', message: 'Query param ?ids=mint1,mint2,... is required' },
      400,
      requestId,
    );
  }

  // Sanitize: split by comma, trim, dedupe, limit
  const ids = [...new Set(rawIds.split(',').map(s => s.trim()).filter(Boolean))].slice(0, MAX_IDS);

  try {
    const upstreamUrl = `${JUPITER_PRICE_URL}?ids=${ids.join(',')}`;
    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        Accept: 'application/json',
        ...(JUPITER_API_KEY ? { 'x-api-key': JUPITER_API_KEY } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => '');
      console.warn(`[price/proxy] Jupiter returned ${upstreamRes.status}:`, text.slice(0, 200));
      return jsonResponse(
        request,
        {
          success: false,
          error: 'UPSTREAM_ERROR',
          message: `Jupiter Price API returned ${upstreamRes.status}`,
          data: {},
        },
        502,
        requestId,
      );
    }

    const json = await upstreamRes.json();
    // Pass through the Jupiter response shape unchanged
    return jsonResponse(request, { success: true, ...json }, 200, requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[price/proxy] fetch failed:', msg);
    return jsonResponse(
      request,
      {
        success: false,
        error: 'FETCH_ERROR',
        message: msg,
        data: {},
      },
      502,
      requestId,
    );
  }
}
