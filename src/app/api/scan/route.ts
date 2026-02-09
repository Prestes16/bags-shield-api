/**
 * Hardened /api/scan endpoint with strict validation and anti-forgery
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { LaunchpadValidator } from '@/lib/security/validate';
import {
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
  getOrGenerateRequestId,
  SafeLogger,
} from '@/lib/security';
import { isHeliusConfigured } from '@/lib/helius';
import {
  fetchHeliusAsset,
  fetchBirdeyeTokenOverview,
  fetchDexScreenerTokenPairs,
  fetchMeteoraPairsForMint,
  type SourceMetaItem,
} from '@/lib/providers';
import { collectSignals, runEngine } from '@/lib/score';

// Rate limiting - simple in-memory store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20; // 20 requests per minute per IP

async function applyRateLimit(req: NextRequest): Promise<{ success: true } | NextResponse> {
  const requestId = getOrGenerateRequestId(req.headers);

  // Extract client IP
  const clientIP =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';

  const now = Date.now();
  const key = `scan:${clientIP}`;

  // Clean up expired entries occasionally
  if (Math.random() < 0.1) {
    for (const [k, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
  }

  const entry = rateLimitStore.get(key);

  if (entry) {
    if (entry.resetTime > now) {
      // Within window
      if (entry.count >= RATE_LIMIT_MAX) {
        const resetInSeconds = Math.ceil((entry.resetTime - now) / 1000);

        SafeLogger.warn('Rate limit exceeded', {
          requestId,
          clientIP: clientIP.substring(0, 8) + '...',
          count: entry.count,
          resetIn: resetInSeconds,
        });

        const response = jsonSafe(
          429,
          {
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests. Please try again later.',
              retryAfter: resetInSeconds,
            },
            meta: { requestId },
          },
          { 'x-request-id': requestId, 'retry-after': String(resetInSeconds) },
        );

        response.headers.set('retry-after', resetInSeconds.toString());
        applyCorsHeaders(req, response);
        applyNoStore(response);
        applySecurityHeaders(response);

        return response;
      }

      entry.count++;
    } else {
      // Reset window
      entry.count = 1;
      entry.resetTime = now + RATE_LIMIT_WINDOW;
    }
  } else {
    // New entry
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
  }

  return { success: true };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Strict request schema - fail-closed
const ScanRequestSchema = z
  .object({
    mint: z
      .string()
      .trim()
      .min(32, 'mint must be at least 32 characters')
      .max(44, 'mint must be at most 44 characters')
      .refine(LaunchpadValidator.validateMint, 'invalid mint address'),
    amount: z.number().finite().min(0, 'amount must be >= 0').max(1_000_000_000, 'amount too large').optional(),
    wallet: z.string().trim().refine(LaunchpadValidator.validateWallet, 'invalid wallet address').optional(),
    slippage: z.number().min(0, 'slippage must be >= 0').max(100, 'slippage must be <= 100').optional(),
    locale: z.enum(['en', 'pt', 'es', 'fr']).optional(),
    referrer: z.string().trim().max(128, 'referrer too long').optional(),
  })
  .strict(); // Reject unknown keys

const MAX_BODY_SIZE = 16 * 1024; // 16KB
const DEFAULT_API_BASE = 'https://bags-shield-api.vercel.app';
const HANDLER = 'bs-app-scan';
const BS_HANDLER = HANDLER;

function getApiBase(): string {
  const base = process.env.BAGS_SHIELD_API_BASE?.trim() || DEFAULT_API_BASE;
  return base.replace(/\/+$/, '');
}

/** Bloqueia apenas quando upstream é o MESMO origin do request (loop real). Permite 127.0.0.1:3001 em dev. */
function wouldProxyToSelf(apiBase: string, requestUrl: string): boolean {
  try {
    const baseUrl = new URL(apiBase);
    const reqUrl = new URL(requestUrl);
    return baseUrl.host === reqUrl.host;
  } catch {
    return false;
  }
}

function stringifySafeJson(obj: unknown): string {
  return JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
}

function safeStableStringify(obj: unknown): string {
  const seen = new WeakSet<object>();
  const normalize = (v: unknown): unknown => {
    if (typeof v === 'bigint') return v.toString();
    if (v instanceof Map) return Object.fromEntries([...v.entries()].map(([k, val]) => [String(k), normalize(val)]));
    if (v instanceof Set) return [...v.values()].map(normalize);
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'function') return undefined;
    if (typeof v === 'symbol') return String(v);
    if (v && typeof v === 'object') {
      if (seen.has(v as object)) return '[Circular]';
      seen.add(v as object);
      if (Array.isArray(v)) return v.map(normalize);
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as object).sort()) out[k] = normalize((v as Record<string, unknown>)[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(normalize(obj));
}

function upstreamsHeader(helius: string, dexscreener = 'n/a', birdeye = 'n/a', meteora = 'n/a'): string {
  return `helius=${helius}; dexscreener=${dexscreener}; birdeye=${birdeye}; meteora=${meteora}`;
}

function jsonSafe(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
  upstreams?: string,
): NextResponse {
  const h: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-bs-handler': BS_HANDLER,
    ...headers,
  };
  if (upstreams) h['x-bs-upstreams'] = upstreams;
  return new NextResponse(stringifySafeJson(body), { status, headers: h });
}

function sanitizeUpstreamError(msg: string): string {
  return msg
    .replace(/api-?key[=:]\s*[\w-]+/gi, 'api-key=[REDACTED]')
    .replace(/token[=:]\s*[\w-]+/gi, 'token=[REDACTED]')
    .replace(/x-api-key[=:]\s*[\w-]+/gi, 'x-api-key=[REDACTED]')
    .replace(/jpk_[\w-]+/gi, 'jpk_[REDACTED]')
    .replace(/bearer\s+[\w.-]+/gi, 'bearer [REDACTED]');
}

function badRequest(error: string, requestId: string, req: NextRequest) {
  const res = jsonSafe(400, { success: false, error }, { 'x-request-id': requestId });
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  return res;
}

async function validateRequest(req: NextRequest): Promise<
  | {
      data: z.infer<typeof ScanRequestSchema>;
      requestId: string;
    }
  | NextResponse
> {
  const requestId = getOrGenerateRequestId(req.headers);

  // Body size limit check
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
    SafeLogger.warn('Request body too large', { requestId });
    const res = jsonSafe(
      413,
      {
        success: false,
        error: `Request body exceeds size limit (max ${MAX_BODY_SIZE} bytes).`,
      },
      { 'x-request-id': requestId },
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    applySecurityHeaders(res);
    return res;
  }

  // Content-Type enforcement for POST
  if (req.method === 'POST') {
    const contentType = req.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      SafeLogger.warn('Invalid content-type', { requestId });
      return badRequest('Content-Type must be application/json.', requestId, req);
    }
  }

  let rawData: unknown;

  if (req.method === 'GET') {
    const { searchParams } = new URL(req.url);
    const mint = searchParams.get('mint')?.trim();
    if (!mint) {
      return badRequest('Missing mint.', requestId, req);
    }
    rawData = {
      mint,
      amount: searchParams.get('amount') ? parseFloat(searchParams.get('amount')!) : undefined,
      wallet: searchParams.get('wallet') || undefined,
      slippage: searchParams.get('slippage') ? parseFloat(searchParams.get('slippage')!) : undefined,
      locale: searchParams.get('locale') || undefined,
      referrer: searchParams.get('referrer') || undefined,
    };
  } else {
    // Parse JSON in try/catch — only catch parse errors
    try {
      rawData = await req.json();
    } catch {
      SafeLogger.warn('bad json', { requestId });
      return badRequest('Invalid JSON body.', requestId, req);
    }

    if (!rawData || typeof rawData !== 'object') {
      return badRequest('Request body must be a JSON object.', requestId, req);
    }

    // Strip client-provided integrity fields
    const obj = rawData as Record<string, unknown>;
    delete obj.integrity;
    delete obj.signature;
    delete obj.payloadHash;
    delete obj.evaluatedAt;
    delete obj.deploymentId;

    const mintVal = obj.mint;
    if (mintVal == null || (typeof mintVal === 'string' && !mintVal.trim())) {
      return badRequest('Missing mint.', requestId, req);
    }
  }

  // Schema validation — return specific message, not "Invalid JSON body"
  const validation = ScanRequestSchema.safeParse(rawData);
  if (!validation.success) {
    const first = validation.error.issues[0];
    const msg = first ? (typeof first.message === 'string' ? first.message : 'Validation failed') : 'Validation failed';
    SafeLogger.warn('Request validation failed', { requestId });
    return badRequest(msg, requestId, req);
  }

  return { data: validation.data, requestId };
}

function make500Response(requestId: string, err: unknown, req: NextRequest): NextResponse {
  const e = err as { message?: string };
  const hint =
    process.env.NODE_ENV !== 'production'
      ? sanitizeUpstreamError(String(e?.message ?? 'error')).slice(0, 120)
      : undefined;
  const body: Record<string, unknown> = {
    success: false,
    error: 'Scan failed',
    code: 'SCAN_INTERNAL',
    reqId: requestId,
  };
  if (hint) body.hint = hint;
  const res = new NextResponse(JSON.stringify(body), {
    status: 500,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-bs-handler': BS_HANDLER,
      'x-bs-upstreams': upstreamsHeader('error'),
      'x-request-id': requestId,
    },
  });
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  return res;
}

export async function POST(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);
  try {
    // Fail-closed IMEDIATO: HELIUS_RPC_URL ou HELIUS_API_KEY (len>=30)
    if (!isHeliusConfigured()) return heliusNotConfigured(requestId, req);

    const rateLimitResult = await applyRateLimit(req);
    if ('status' in rateLimitResult) return rateLimitResult;

    const validation = await validateRequest(req);
    if ('status' in validation) return validation;
    return await processScanRequest(validation.data, validation.requestId, req);
  } catch (err) {
    SafeLogger.warn('Scan handler error', { requestId });
    return make500Response(requestId, err, req);
  }
}

export async function GET(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);
  try {
    // Fail-closed IMEDIATO: HELIUS_RPC_URL ou HELIUS_API_KEY (len>=30)
    if (!isHeliusConfigured()) return heliusNotConfigured(requestId, req);

    const rateLimitResult = await applyRateLimit(req);
    if ('status' in rateLimitResult) return rateLimitResult;

    const validation = await validateRequest(req);
    if ('status' in validation) return validation;
    return await processScanRequest(validation.data, validation.requestId, req);
  } catch (err) {
    SafeLogger.warn('Scan handler error', { requestId });
    return make500Response(requestId, err, req);
  }
}

function jsonScanError(status: number, error: string, requestId: string, req: NextRequest, upstreams?: string) {
  const headers: Record<string, string> = { 'x-request-id': requestId };
  const res = jsonSafe(status, { success: false, error }, headers, upstreams);
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  return res;
}

function heliusNotConfigured(requestId: string, req: NextRequest): NextResponse {
  const body = JSON.stringify({
    success: false,
    error: 'Helius not configured (missing/invalid HELIUS_RPC_URL or HELIUS_API_KEY).',
    code: 'HELIUS_NOT_CONFIGURED',
    reqId: requestId,
  });
  const res = new NextResponse(body, {
    status: 501,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-bs-handler': BS_HANDLER,
      'x-bs-upstreams': upstreamsHeader('not-configured'),
      'x-request-id': requestId,
    },
  });
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  return res;
}

function formatUpstreamsHeaderFromSources(sources: SourceMetaItem[]): string {
  const parts = sources.map((s) => `${s.name}=${s.ok ? 'ok' : 'down'}`);
  return parts.join('; ') || 'helius=ok';
}

async function runLocalScan(
  data: z.infer<typeof ScanRequestSchema>,
  requestId: string,
  req: NextRequest,
): Promise<NextResponse> {
  const mint = data.mint;
  const fetchStart = Date.now();

  const [heliusR, birdeyeR, dexscreenerR, meteoraR] = await Promise.all([
    fetchHeliusAsset(mint),
    fetchBirdeyeTokenOverview(mint),
    fetchDexScreenerTokenPairs(mint),
    fetchMeteoraPairsForMint(mint),
  ]);

  const fetchMs = Date.now() - fetchStart;

  const sources: SourceMetaItem[] = [
    {
      name: 'helius',
      ok: heliusR.ok,
      latencyMs: heliusR.latencyMs,
      fetchedAt: new Date().toISOString(),
      quality: heliusR.quality,
      error: heliusR.error,
    },
    {
      name: 'birdeye',
      ok: birdeyeR.ok,
      latencyMs: birdeyeR.latencyMs,
      fetchedAt: new Date().toISOString(),
      quality: birdeyeR.quality,
      error: birdeyeR.error,
    },
    {
      name: 'dexscreener',
      ok: dexscreenerR.ok,
      latencyMs: dexscreenerR.latencyMs,
      fetchedAt: new Date().toISOString(),
      quality: dexscreenerR.quality,
      error: dexscreenerR.error,
    },
    {
      name: 'meteora',
      ok: meteoraR.ok,
      latencyMs: meteoraR.latencyMs,
      fetchedAt: new Date().toISOString(),
      quality: meteoraR.quality,
      error: meteoraR.error,
    },
  ];

  const upsHeader = formatUpstreamsHeaderFromSources(sources);

  if (!heliusR.ok) {
    if (heliusR.error?.toLowerCase().includes('invalid api key'))
      return jsonScanError(401, 'Helius API key inválida (401).', requestId, req, upsHeader);
    return jsonScanError(
      502,
      heliusR.error === 'Timeout' ? 'Helius indisponível' : `Helius upstream error (${heliusR.error}).`,
      requestId,
      req,
      upsHeader,
    );
  }

  const computeStart = Date.now();
  const signals = collectSignals(mint, {
    helius: heliusR,
    birdeye: birdeyeR,
    dexscreener: dexscreenerR,
    meteora: meteoraR,
  });
  const engineResult = runEngine(signals);
  const computeMs = Date.now() - computeStart;
  const totalMs = Date.now() - fetchStart;

  const responseData = {
    success: true,
    response: {
      mint,
      score: engineResult.score,
      badge: engineResult.badge,
      confidence: engineResult.confidence,
      reasons: engineResult.reasons,
      signals: {
        data_conflict: signals.dataConflict,
        sourcesOk: signals.sourcesOk,
        sourcesTotal: signals.sourcesTotal,
        mintActive: signals.mintActive,
        lpLockSeconds: signals.lpLockSeconds,
        top10ConcentrationPercent: signals.top10ConcentrationPercent,
        sellTaxBps: signals.sellTaxBps,
      },
      market: {
        price: signals.market.priceUsd ?? 0,
        liquidity: signals.market.liquidityUsd ?? 0,
        volume24h: signals.market.volume24hUsd ?? 0,
        sourcesUsed: signals.market.sourcesUsed,
      },
      pools: engineResult.signals.pools.map((p) => ({
        type: p.type,
        address: p.address,
        liquidity: p.liquidity,
        lpLocked: p.lpLocked,
        evidence: p.evidence,
      })),
      actors: {
        botLikely: engineResult.signals.actors.botLikely,
        washLikely: engineResult.signals.actors.washLikely,
        notes: engineResult.signals.actors.notes,
      },
      ts: new Date().toISOString(),
    },
    meta: {
      requestId,
      sources,
      timingMs: {
        total: totalMs,
        fetch: fetchMs,
        compute: computeMs,
        cache: 'MISS',
      },
    },
  };

  let integrityData: Awaited<ReturnType<typeof generateIntegrityData>> = null;
  try {
    integrityData = await generateIntegrityData(responseData, requestId);
  } catch {
    SafeLogger.warn('Integrity generation failed', { requestId });
  }
  if (integrityData) {
    (responseData as Record<string, unknown>).integrity = integrityData;
  } else {
    const meta = responseData.meta as Record<string, unknown>;
    (meta.evidence as Record<string, unknown>) = { integrity: { status: 'disabled', reason: 'internal' } };
  }

  const finalResponse = jsonSafe(200, responseData, { 'x-request-id': requestId }, upsHeader);
  applyCorsHeaders(req, finalResponse);
  applyNoStore(finalResponse);
  applySecurityHeaders(finalResponse);
  return finalResponse;
}

async function processScanRequest(data: z.infer<typeof ScanRequestSchema>, requestId: string, req: NextRequest) {
  if (!isHeliusConfigured()) {
    return heliusNotConfigured(requestId, req);
  }

  const API_BASE = getApiBase();
  const useProxy = !!process.env.BAGS_SHIELD_API_BASE?.trim() && !wouldProxyToSelf(API_BASE, req.url);

  // Local scan: Helius + DexScreener + Birdeye + Meteora (todos por igual, Promise.allSettled)
  if (!useProxy) {
    return runLocalScan(data, requestId, req);
  }

  // Forward to upstream with strict timeout and budget control
  const controller = new AbortController();
  const UPSTREAM_TIMEOUT = 12_000; // 12s timeout (stricter)
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);

  try {
    const upstreamUrl = `${API_BASE}/api/scan`;

    const response = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-request-id': requestId,
        'cache-control': 'no-store',
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    // 401/403/429/5xx → nunca 500; mapear para status correto; logs sem vazar body
    if (!response.ok) {
      const status = response.status;
      SafeLogger.warn('Helius non-OK', { requestId, status });
      const ups =
        status === 401
          ? upstreamsHeader('401')
          : status === 403
            ? upstreamsHeader('403')
            : status === 429
              ? upstreamsHeader('429')
              : upstreamsHeader('5xx');
      if (status === 401) {
        return jsonScanError(401, 'Helius API key inválida (401).', requestId, req, ups);
      }
      if (status === 403) {
        return jsonScanError(403, 'Helius RPC restrito (403).', requestId, req, ups);
      }
      if (status === 429 || status >= 500) {
        return jsonScanError(502, `Helius upstream error (${status}).`, requestId, req, ups);
      }
      return jsonScanError(502, `Helius upstream error (${status}).`, requestId, req, ups);
    }

    const responseText = await response.text();
    let responseData: any;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      SafeLogger.warn('Helius non-OK', { requestId, status: 502 });
      return jsonScanError(502, 'Helius upstream error (502).', requestId, req, upstreamsHeader('5xx'));
    }

    // Helius/JSON-RPC: retorna 200 com { error: { code: -32401, message: "invalid api key" } }
    const rpcError = responseData?.error;
    if (rpcError && typeof rpcError === 'object') {
      const code = rpcError.code;
      const msg = String(rpcError.message ?? '');
      if (code === -32401 || /invalid api key/i.test(msg)) {
        SafeLogger.warn('Helius non-OK', { requestId, status: 401 });
        return jsonScanError(401, 'Helius API key inválida (401).', requestId, req, upstreamsHeader('401'));
      }
    }

    let integrityData: Awaited<ReturnType<typeof generateIntegrityData>> = null;
    try {
      integrityData = await generateIntegrityData(responseData, requestId);
    } catch {
      SafeLogger.warn('Integrity generation failed', { requestId });
    }
    if (responseData && typeof responseData === 'object') {
      if (integrityData) {
        responseData.integrity = integrityData;
      } else {
        const meta = (responseData.meta ??= {}) as Record<string, unknown>;
        const evidence = (meta.evidence ??= {}) as Record<string, unknown>;
        evidence.integrity = { status: 'disabled', reason: 'internal' };
      }
    }

    const finalResponse = jsonSafe(response.status, responseData, { 'x-request-id': requestId }, upstreamsHeader('ok'));
    applyCorsHeaders(req, finalResponse);
    applyNoStore(finalResponse);
    applySecurityHeaders(finalResponse);
    return finalResponse;
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string; code?: string };
    const isNetwork =
      e?.name === 'AbortError' ||
      e?.code === 'ECONNREFUSED' ||
      e?.code === 'ENOTFOUND' ||
      e?.code === 'ETIMEDOUT' ||
      (e?.name === 'TypeError' && typeof e?.message === 'string' && /fetch|network/i.test(e.message));
    if (isNetwork) {
      SafeLogger.warn('Helius non-OK', { requestId, status: 502 });
      return jsonScanError(502, 'Helius indisponível', requestId, req, upstreamsHeader('timeout'));
    }
    // Erro interno nosso → 500 com code+reqId+hint (bulletproof)
    SafeLogger.warn('Scan internal error', { requestId });
    const hint =
      process.env.NODE_ENV !== 'production'
        ? sanitizeUpstreamError(String(e?.message ?? 'error')).slice(0, 120)
        : undefined;
    const body: { success: false; error: string; code: string; reqId: string; hint?: string } = {
      success: false,
      error: 'Scan failed',
      code: 'SCAN_INTERNAL',
      reqId: requestId,
    };
    if (hint) body.hint = hint;
    const bodyStr = JSON.stringify(body);
    const res = new NextResponse(bodyStr, {
      status: 500,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-bs-handler': BS_HANDLER,
        'x-bs-upstreams': upstreamsHeader('error'),
        'x-request-id': requestId,
      },
    });
    applyCorsHeaders(req, res);
    applyNoStore(res);
    applySecurityHeaders(res);
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateIntegrityData(
  payload: unknown,
  requestId: string,
): Promise<{
  payloadHash: string;
  signature: string;
  evaluatedAt: string;
  requestId: string;
  deploymentId: string;
} | null> {
  const secret = process.env.SCAN_HMAC_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'development') {
      SafeLogger.warn('SCAN_HMAC_SECRET not set', { requestId });
    }
    return null;
  }

  const corePayload = extractCorePayload(payload);
  let payloadString: string;
  try {
    payloadString = safeStableStringify(corePayload);
  } catch {
    SafeLogger.warn('Integrity serialization failed', { requestId });
    return null;
  }

  try {
    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(payloadString);
    const payloadHash = await crypto.subtle.digest('SHA-256', payloadBytes);
    const payloadHashHex = Array.from(new Uint8Array(payloadHash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const signatureKey = secret;
    const keyBytes = encoder.encode(signatureKey);
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signatureData = encoder.encode(`${payloadHashHex}.${requestId}`);
    const signature = await crypto.subtle.sign('HMAC', key, signatureData);
    const signatureHex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return {
      payloadHash: payloadHashHex,
      signature: signatureHex,
      evaluatedAt: new Date().toISOString(),
      requestId,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || 'local',
    };
  } catch {
    SafeLogger.warn('Integrity HMAC failed', { requestId });
    return null;
  }
}

/**
 * Extract minimal serializable core payload (BigInt/circular-safe)
 * Supports both legacy shape (mint, grade, score) and canonical shape (response: { mint, score, badge }).
 */
function extractCorePayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {};
  const p = payload as Record<string, unknown>;
  const res = (p.response && typeof p.response === 'object' ? p.response : p) as Record<string, unknown>;
  const reasons = Array.isArray(res.reasons) ? res.reasons : [];
  const badges = Array.isArray(p.badges) ? p.badges : [];

  return {
    mint: String(res.mint ?? p.mint ?? ''),
    grade: String(res.badge ?? p.grade ?? ''),
    score:
      typeof res.score === 'number'
        ? res.score
        : typeof p.score === 'number'
          ? p.score
          : Number(res.score ?? p.score ?? 0),
    summary: String((res.reasons?.[0] as { title?: string })?.title ?? p.summary ?? '').slice(0, 500),
    reasons: reasons.slice(0, 50).map((r: unknown) => {
      const x = r && typeof r === 'object' ? (r as Record<string, unknown>) : {};
      return { code: String(x.code ?? ''), severity: String(x.severity ?? '') };
    }),
    counts: { reasons: reasons.length, badges: badges.length },
  };
}
