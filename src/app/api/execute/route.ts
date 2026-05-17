/**
 * POST /api/execute — Jupiter Swap V2 /execute
 * Recebe a transação ASSINADA pelo frontend e delega o landing ao Jupiter.
 * Body: { signedTransaction: string (base64), requestId: string, lastValidBlockHeight?: string }
 * Jupiter gerencia retry, confirmação e landing — não precisa de RPC próprio.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOrGenerateRequestId, applyCorsHeaders, applyNoStore, applySecurityHeaders } from '@/lib/security';
import { checkRateLimitByIp, getClientIp } from '@/lib/security/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const JUP_V2_BASE = 'https://api.jup.ag/ultra/v1';
const RATE_LIMIT  = { windowMs: 60_000, max: 15 };

const ExecuteSchema = z.object({
  signedTransaction:    z.string().min(10).max(8192),  // base64 tx assinada
  requestId:            z.string().min(1).max(256),   // Jupiter Ultra requestId (não é UUID)
  lastValidBlockHeight: z.string().optional(),
}).strict();

export async function OPTIONS(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  applyCorsHeaders(req, res);
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  applyNoStore(res);
  applySecurityHeaders(res);
  return res;
}

export async function POST(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);
  const ip        = getClientIp(req.headers);
  const { allowed, remaining, resetAt } = checkRateLimitByIp(ip, 'execute', RATE_LIMIT);

  const fail = (msg: string, status = 400, code?: string) => {
    const r = NextResponse.json(
      { success: false, error: code ? { code, message: msg } : msg, meta: { requestId } },
      { status, headers: { 'X-Request-Id': requestId } },
    );
    applyCorsHeaders(req, r);
    applyNoStore(r);
    return r;
  };

  if (!allowed) return fail(`Rate limit. Retry in ${Math.ceil((resetAt - Date.now()) / 1000)}s`, 429, 'RATE_LIMIT');

  let body: unknown;
  try { body = await req.json(); } catch { return fail('Invalid JSON body'); }

  const parsed = ExecuteSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Validation failed');

  const { signedTransaction, requestId: jupRequestId, lastValidBlockHeight } = parsed.data;

  const payload: Record<string, string> = { signedTransaction, requestId: jupRequestId };
  if (lastValidBlockHeight) payload.lastValidBlockHeight = lastValidBlockHeight;

  const t0 = Date.now();
  try {
    const upstream = await fetch(`${JUP_V2_BASE}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const data = await upstream.json();
    const latencyMs = Date.now() - t0;

    if (!upstream.ok || data?.status === 'Failed') {
      return fail(data?.error ?? `Jupiter execute error (${upstream.status})`, upstream.ok ? 400 : 502, data?.code ? `JUP_${data.code}` : 'EXECUTE_FAILED');
    }

    const res = NextResponse.json(
      {
        success: true,
        response: {
          status:    data.status,
          signature: data.signature,
          slot:      data.slot,
          inputAmountResult:  data.inputAmountResult,
          outputAmountResult: data.outputAmountResult,
        },
        meta: { requestId, latencyMs },
      },
      { status: 200, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } },
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    applySecurityHeaders(res);
    res.headers.set('X-RateLimit-Remaining', String(remaining - 1));
    return res;
  } catch (e: any) {
    return fail(e?.message ?? 'Jupiter execute unavailable', 502, 'UPSTREAM_ERROR');
  }
}
