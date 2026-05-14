/**
 * GET /api/order — Jupiter Swap V2 /order (Meta-Aggregator)
 * Combina quote + routing em uma chamada. Retorna requestId para uso no /execute.
 * Params: inputMint, outputMint, amount (base units), slippageBps, userPublicKey
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOrGenerateRequestId, applyCorsHeaders, applyNoStore, applySecurityHeaders } from '@/lib/security';
import { checkRateLimitByIp, getClientIp } from '@/lib/security/rateLimit';
import { LaunchpadValidator } from '@/lib/security/validate';
import { APP_FEE_BPS, getExistingFeeCollectorTokenAccount } from '@/lib/solana/fees';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const JUP_V2_BASE = 'https://api.jup.ag/ultra/v1';
const NATIVE_SOL  = 'So11111111111111111111111111111111111111112';
const RATE_LIMIT  = { windowMs: 60_000, max: 30 };

const OrderSchema = z.object({
  inputMint:     z.string().trim().min(32).max(44).refine((v) => LaunchpadValidator.validateMint(v).valid, 'invalid inputMint'),
  outputMint:    z.string().trim().min(32).max(44).refine((v) => LaunchpadValidator.validateMint(v).valid, 'invalid outputMint'),
  amount:        z.string().trim().min(1).max(30),
  slippageBps:   z.coerce.number().min(1).max(5000).optional().default(100),
  userPublicKey: z.string().trim().min(32).max(44).refine((v) => LaunchpadValidator.validateMint(v).valid, 'invalid userPublicKey'),
}).strict();

export async function OPTIONS(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  applyCorsHeaders(req, res);
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  applyNoStore(res);
  applySecurityHeaders(res);
  return res;
}

export async function GET(req: NextRequest) {
  const requestId  = getOrGenerateRequestId(req.headers);
  const ip         = getClientIp(req.headers);
  const { allowed, remaining, resetAt } = checkRateLimitByIp(ip, 'order', RATE_LIMIT);

  const fail = (msg: string, status = 400) => {
    const r = NextResponse.json(
      { success: false, error: msg, meta: { requestId } },
      { status, headers: { 'X-Request-Id': requestId } },
    );
    applyCorsHeaders(req, r);
    applyNoStore(r);
    return r;
  };

  if (!allowed) return fail(`Rate limit. Retry in ${Math.ceil((resetAt - Date.now()) / 1000)}s`, 429);

  const { searchParams } = new URL(req.url);
  const raw = {
    inputMint:     searchParams.get('inputMint')?.trim(),
    outputMint:    searchParams.get('outputMint')?.trim(),
    amount:        searchParams.get('amount')?.trim(),
    slippageBps:   searchParams.get('slippageBps') ? Number(searchParams.get('slippageBps')) : undefined,
    userPublicKey: searchParams.get('userPublicKey')?.trim(),
  };

  const parsed = OrderSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Validation failed');

  const { inputMint, outputMint, amount, slippageBps, userPublicKey } = parsed.data;

  // Resolve fee account para fee collection (50 bps)
  let platformFeeBps: number | undefined;
  let feeAccount: string | undefined;
  try {
    const mints = inputMint === NATIVE_SOL ? [outputMint, inputMint] : [inputMint, outputMint];
    for (const mint of mints) {
      const acc = await getExistingFeeCollectorTokenAccount(mint);
      if (acc) { feeAccount = acc; platformFeeBps = APP_FEE_BPS; break; }
    }
  } catch { /* sem fee se não resolver */ }

  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: String(slippageBps),
    taker: userPublicKey, // Jupiter Swap V2 usa 'taker', não 'userPublicKey'
  });
  if (platformFeeBps && feeAccount) {
    params.set('platformFeeBps', String(platformFeeBps));
    params.set('feeAccount', feeAccount);
  }

  const t0 = Date.now();
  try {
    const upstream = await fetch(`${JUP_V2_BASE}/order?${params}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const data = await upstream.json();
    const latencyMs = Date.now() - t0;

    if (!upstream.ok) return fail(data?.error ?? `Jupiter order error (${upstream.status})`, 502);

    const res = NextResponse.json(
      { success: true, response: data, meta: { requestId, latencyMs } },
      { status: 200, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } },
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    applySecurityHeaders(res);
    res.headers.set('X-RateLimit-Remaining', String(remaining - 1));
    return res;
  } catch (e: any) {
    return fail(e?.message ?? 'Jupiter order unavailable', 502);
  }
}