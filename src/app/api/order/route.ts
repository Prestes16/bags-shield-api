/**
 * GET /api/order - Jupiter /order (Meta-Aggregator)
 * Combines quote + routing in one call and returns requestId for /execute.
 * Params: inputMint, outputMint, amount (base units), slippageBps, userPublicKey
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PublicKey } from '@solana/web3.js';
import { getOrGenerateRequestId, applyCorsHeaders, applyNoStore, applySecurityHeaders } from '@/lib/security';
import { checkRateLimitByIp, getClientIp } from '@/lib/security/rateLimit';
import { LaunchpadValidator } from '@/lib/security/validate';
import { APP_FEE_BPS } from '@/lib/solana/fees';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT = { windowMs: 60_000, max: 30 };
const JUPITER_API_KEY = (process.env.JUPITER_API_KEY ?? '').trim();
const JUPITER_SWAP_BASE = JUPITER_API_KEY ? 'https://api.jup.ag/swap/v2' : 'https://api.jup.ag/ultra/v1';

const OrderSchema = z.object({
  inputMint: z.string().trim().min(32).max(44).refine((v) => LaunchpadValidator.validateMint(v).valid, 'invalid inputMint'),
  outputMint: z.string().trim().min(32).max(44).refine((v) => LaunchpadValidator.validateMint(v).valid, 'invalid outputMint'),
  amount: z.string().trim().min(1).max(30),
  slippageBps: z.coerce.number().min(1).max(5000).optional().default(100),
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
  const requestId = getOrGenerateRequestId(req.headers);
  const ip = getClientIp(req.headers);
  const { allowed, remaining, resetAt } = checkRateLimitByIp(ip, 'order', RATE_LIMIT);

  const fail = (msg: string, status = 400, code?: string, details?: Record<string, unknown>) => {
    const r = NextResponse.json(
      {
        success: false,
        error: code ? { code, message: msg, ...(details ?? {}) } : msg,
        meta: { requestId },
      },
      { status, headers: { 'X-Request-Id': requestId } },
    );
    applyCorsHeaders(req, r);
    applyNoStore(r);
    applySecurityHeaders(r);
    return r;
  };

  if (!allowed) return fail(`Rate limit. Retry in ${Math.ceil((resetAt - Date.now()) / 1000)}s`, 429, 'RATE_LIMIT');

  const { searchParams } = new URL(req.url);
  const raw = {
    inputMint: searchParams.get('inputMint')?.trim(),
    outputMint: searchParams.get('outputMint')?.trim(),
    amount: searchParams.get('amount')?.trim(),
    slippageBps: searchParams.get('slippageBps') ? Number(searchParams.get('slippageBps')) : undefined,
    userPublicKey: searchParams.get('userPublicKey')?.trim(),
  };

  const parsed = OrderSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Validation failed');

  const { inputMint, outputMint, amount, slippageBps, userPublicKey } = parsed.data;

  const feeBps = APP_FEE_BPS;
  const feesEnabled = feeBps > 0;
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 255) {
    return fail('Invalid APP_FEE_BPS configuration.', 500, 'SWAP_FEE_CONFIG_INVALID');
  }
  if (feesEnabled && feeBps < 50) {
    return fail('Jupiter referral fees require APP_FEE_BPS between 50 and 255.', 500, 'SWAP_FEE_CONFIG_INVALID');
  }
  if (feesEnabled && !JUPITER_API_KEY) {
    return fail(
      'JUPITER_API_KEY is required for Jupiter /order referral fees; swap disabled to avoid silent zero-fee execution.',
      503,
      'SWAP_FEE_API_KEY_REQUIRED',
    );
  }

  // Primary /order fees must use Jupiter Referral Program params.
  // Normal collector ATAs are valid for the legacy Metis /swap fallback, but
  // they do not activate integrator fees on the primary /order execution path.
  let referralAccount: string | undefined;
  if (feesEnabled) {
    const referralAccountEnv = (process.env.JUPITER_REFERRAL_ACCOUNT ?? '').trim();
    if (!referralAccountEnv) {
      return fail(
        'Swap fee referral account is not configured; swap disabled to avoid silent zero-fee execution.',
        503,
        'SWAP_FEE_NOT_CONFIGURED',
      );
    }

    try {
      referralAccount = new PublicKey(referralAccountEnv).toBase58();
      console.log(`[order] referral fee requested: ${feeBps}bps referralAccount=${referralAccount}`);
    } catch (e: any) {
      console.warn('[order] invalid JUPITER_REFERRAL_ACCOUNT:', e?.message);
      return fail(
        'Swap fee referral account is invalid; swap disabled to avoid silent zero-fee execution.',
        500,
        'SWAP_FEE_CONFIG_INVALID',
      );
    }
  }

  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: String(slippageBps),
    taker: userPublicKey,
  });
  if (feesEnabled && referralAccount) {
    params.set('referralAccount', referralAccount);
    params.set('referralFee', String(feeBps));
  }

  const t0 = Date.now();
  try {
    const upstream = await fetch(`${JUPITER_SWAP_BASE}/order?${params}`, {
      headers: {
        Accept: 'application/json',
        ...(JUPITER_API_KEY ? { 'x-api-key': JUPITER_API_KEY } : {}),
      },
      cache: 'no-store',
    });
    const data = await upstream.json();
    const latencyMs = Date.now() - t0;

    if (!upstream.ok) {
      const clientError = upstream.status >= 400 && upstream.status < 500;
      const errMsg = data?.error ?? `Jupiter order error (${upstream.status})`;
      return fail(errMsg, clientError ? 422 : 502, clientError ? 'JUPITER_ORDER_REJECTED' : 'JUPITER_ORDER_UNAVAILABLE');
    }

    if (feesEnabled) {
      const returnedFeeBps = Number(data?.feeBps ?? 0);
      const returnedReferralAccount = typeof data?.referralAccount === 'string' ? data.referralAccount : undefined;
      const feeApplied = returnedReferralAccount === referralAccount && returnedFeeBps >= feeBps;

      if (!feeApplied) {
        console.warn(
          `[order] referral fee not applied; feeBps=${returnedFeeBps || 'missing'} feeMint=${data?.feeMint ?? 'unknown'} referral=${returnedReferralAccount ?? 'missing'}`,
        );
        return fail(
          'Jupiter did not apply the Bags Shield swap fee; swap disabled to avoid silent zero-fee execution.',
          502,
          'SWAP_FEE_NOT_APPLIED',
          {
            upstreamFeeBps: Number.isFinite(returnedFeeBps) ? returnedFeeBps : null,
            feeMint: typeof data?.feeMint === 'string' ? data.feeMint : null,
          },
        );
      }
    }

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
    return fail(e?.message ?? 'Jupiter order unavailable', 502, 'UPSTREAM_ERROR');
  }
}
