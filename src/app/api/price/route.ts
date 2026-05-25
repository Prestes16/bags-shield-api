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
import { PublicKey } from '@solana/web3.js';
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

function isValidMint(id: string): boolean {
  try {
    return new PublicKey(id).toBase58() === id;
  } catch {
    return false;
  }
}

function priceSuccessBody(
  ids: string[],
  prices: Record<string, unknown>,
  requestId: string,
  warnings: string[] = [],
  timeTaken?: unknown,
) {
  const missing = ids.filter((id) => prices[id] == null);
  return {
    success: true,
    data: prices,
    ...(timeTaken != null ? { timeTaken } : {}),
    response: {
      prices,
      missing,
      partial: warnings.length > 0 || missing.length > 0,
      warnings,
    },
    meta: { requestId },
  };
}

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
  const invalidIds = ids.filter((id) => !isValidMint(id));
  if (ids.length === 0 || invalidIds.length > 0) {
    return jsonResponse(
      request,
      {
        success: false,
        error: 'INVALID_IDS',
        message: 'All ids must be valid Solana mint public keys',
        issues: invalidIds.map((id) => ({ id, message: 'Invalid Solana public key' })),
      },
      400,
      requestId,
    );
  }

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
        priceSuccessBody(ids, {}, requestId, [`price upstream unavailable (${upstreamRes.status})`]),
        200,
        requestId,
      );
    }

    const json = await upstreamRes.json();
    const prices = json?.data && typeof json.data === 'object' ? json.data : {};
    return jsonResponse(request, priceSuccessBody(ids, prices, requestId, [], json?.timeTaken), 200, requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[price/proxy] fetch failed:', msg);
    return jsonResponse(
      request,
      priceSuccessBody(ids, {}, requestId, ['price upstream unavailable']),
      200,
      requestId,
    );
  }
}
