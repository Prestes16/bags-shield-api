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

// Jupiter Price API V3 docs: https://dev.jup.ag/docs/price
// V3 returns a root object keyed by mint with usdPrice as the canonical USD price.
const JUPITER_PRICE_V3_URL = 'https://api.jup.ag/price/v3';
const JUPITER_PRICE_V2_FALLBACK_URL = 'https://api.jup.ag/price/v2';
const JUPITER_API_KEY = (process.env.JUPITER_API_KEY ?? '').trim();
const TIMEOUT_MS = 5_000;
const MAX_IDS = 50;

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
      partial: missing.length > 0,
      warnings,
    },
    meta: { requestId },
  };
}

function toNumber(value: unknown): number | null {
  const price = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(price) ? price : null;
}

function normalizePriceEntry(entry: unknown): Record<string, unknown> | null {
  if (entry == null) return null;

  if (typeof entry === 'number' || typeof entry === 'string') {
    const price = toNumber(entry);
    return price == null ? null : { price };
  }

  if (typeof entry !== 'object') return null;
  const record = entry as Record<string, unknown>;
  const price = toNumber(record.price ?? record.usdPrice ?? record.value);
  if (price == null) return null;

  return {
    ...record,
    price,
  };
}

function normalizePriceMap(ids: string[], json: unknown): Record<string, unknown> {
  const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const source = root.data && typeof root.data === 'object'
    ? (root.data as Record<string, unknown>)
    : root;
  const prices: Record<string, unknown> = {};

  for (const id of ids) {
    const normalized = normalizePriceEntry(source[id]);
    if (normalized) prices[id] = normalized;
  }

  return prices;
}

async function fetchJupiterPrices(endpoint: string, ids: string[]) {
  const upstreamUrl = `${endpoint}?ids=${ids.join(',')}`;
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
    throw new Error(`HTTP ${upstreamRes.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
  }

  return upstreamRes.json();
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
    const json = await fetchJupiterPrices(JUPITER_PRICE_V3_URL, ids);
    const prices = normalizePriceMap(ids, json);
    return jsonResponse(request, priceSuccessBody(ids, prices, requestId), 200, requestId);
  } catch (e: unknown) {
    const v3Msg = e instanceof Error ? e.message : String(e);
    console.warn('[price/proxy] Jupiter Price V3 failed:', v3Msg);

    try {
      const fallbackJson = await fetchJupiterPrices(JUPITER_PRICE_V2_FALLBACK_URL, ids);
      const prices = normalizePriceMap(ids, fallbackJson);
      const timeTaken =
        fallbackJson && typeof fallbackJson === 'object'
          ? (fallbackJson as Record<string, unknown>).timeTaken
          : undefined;
      return jsonResponse(
        request,
        priceSuccessBody(ids, prices, requestId, ['price v3 unavailable; used v2 fallback'], timeTaken),
        200,
        requestId,
      );
    } catch (fallbackError: unknown) {
      const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      console.warn('[price/proxy] Jupiter Price fallback failed:', fallbackMsg);
      return jsonResponse(
        request,
        priceSuccessBody(ids, {}, requestId, ['price upstream unavailable']),
        200,
        requestId,
      );
    }
  }
}
