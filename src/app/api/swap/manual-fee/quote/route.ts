/**
 * GET /api/swap/manual-fee/quote
 *
 * Returns a manual fee quote in SOL lamports.
 * This is the FALLBACK path used only when Jupiter referral fee (/api/order) returns
 * SWAP_FEE_NOT_APPLIED. Jupiter referral fee is always the preferred path.
 *
 * The manual fee must be paid via an on-chain SOL transfer before the swap is released.
 * Verification happens at /api/swap/manual-fee/verify.
 *
 * Query params:
 *   inputMint      - input token mint (32-44 chars)
 *   outputMint     - output token mint (32-44 chars)
 *   amount         - input amount in base units (lamports for SOL, smallest unit for SPL)
 *   userPublicKey  - user wallet address
 *   quoteUsdValue  - (optional) estimated notional USD value of the swap as a decimal string
 *
 * Env vars consumed:
 *   SWAP_MANUAL_FEE_BPS           - bps charged (default: APP_FEE_BPS or 50)
 *   SWAP_MANUAL_MIN_FEE_LAMPORTS  - minimum fee regardless of bps calc (default: 5000)
 *   SWAP_MANUAL_MAX_FEE_LAMPORTS  - maximum fee cap (default: 2_000_000 = 0.002 SOL)
 *   SWAP_MANUAL_FEE_WALLET        - fee recipient public key (default: APP_FEE_COLLECTOR_OWNER)
 *   SWAP_MANUAL_QUOTE_TTL_SECONDS - how long the quote is valid (default: 300 = 5 min)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PublicKey } from '@solana/web3.js';
import {
  getOrGenerateRequestId,
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
} from '@/lib/security';
import { checkRateLimitByIp, getClientIp } from '@/lib/security/rateLimit';
import { LaunchpadValidator } from '@/lib/security/validate';
import { APP_FEE_BPS, APP_FEE_COLLECTOR_OWNER } from '@/lib/solana/fees';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT = { windowMs: 60_000, max: 60 };

// ── Config ────────────────────────────────────────────────────────────────────

const SOL_MINT = 'So11111111111111111111111111111111111111112';

function getManualFeeBps(): number {
  const v = Number((process.env.SWAP_MANUAL_FEE_BPS ?? '').trim() || String(APP_FEE_BPS));
  return Number.isFinite(v) && v >= 1 && v <= 10000 ? v : APP_FEE_BPS || 50;
}

function getMinFeeLamports(): bigint {
  const v = BigInt((process.env.SWAP_MANUAL_MIN_FEE_LAMPORTS ?? '').trim() || '5000');
  return v > 0n ? v : 5000n;
}

function getMaxFeeLamports(): bigint {
  const v = BigInt((process.env.SWAP_MANUAL_MAX_FEE_LAMPORTS ?? '').trim() || '2000000');
  return v > 0n ? v : 2_000_000n;
}

function getFeeWallet(): string {
  const env = (process.env.SWAP_MANUAL_FEE_WALLET ?? '').trim();
  if (env) {
    try {
      return new PublicKey(env).toBase58();
    } catch {
      // fall through to default
    }
  }
  return APP_FEE_COLLECTOR_OWNER.toBase58();
}

function getQuoteTtlSeconds(): number {
  const v = Number((process.env.SWAP_MANUAL_QUOTE_TTL_SECONDS ?? '').trim() || '300');
  return Number.isFinite(v) && v >= 30 && v <= 3600 ? v : 300;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const QuoteSchema = z
  .object({
    inputMint: z
      .string()
      .trim()
      .min(32)
      .max(44)
      .refine((v) => LaunchpadValidator.validateMint(v).valid, 'invalid inputMint'),
    outputMint: z
      .string()
      .trim()
      .min(32)
      .max(44)
      .refine((v) => LaunchpadValidator.validateMint(v).valid, 'invalid outputMint'),
    amount: z
      .string()
      .trim()
      .min(1)
      .max(30)
      .refine((v) => /^\d+$/.test(v) && BigInt(v) > 0n, 'amount must be a positive integer'),
    userPublicKey: z
      .string()
      .trim()
      .min(32)
      .max(44)
      .refine((v) => LaunchpadValidator.validateMint(v).valid, 'invalid userPublicKey'),
    quoteUsdValue: z
      .string()
      .trim()
      .optional()
      .refine(
        (v) => v === undefined || (!isNaN(Number(v)) && Number(v) >= 0),
        'quoteUsdValue must be a non-negative number',
      ),
  })
  .strict();

// ── Fee calculation ───────────────────────────────────────────────────────────

/**
 * Calculates the manual fee in lamports.
 *
 * Strategy (in priority order):
 *  1. If inputMint is SOL: fee = max(MIN, min(MAX, floor(amount * feeBps / 10000)))
 *  2. Otherwise: flat MIN fee (no reliable price oracle available without external call)
 *
 * The quoteUsdValue param is accepted for future SOL-price-based calculation
 * but is not used in v0 to avoid adding an external price dependency.
 */
function calculateFeeLamports(
  inputMint: string,
  amount: bigint,
  _quoteUsdValue?: string,
): { feeLamports: bigint; basis: string } {
  const feeBps = getManualFeeBps();
  const minFee = getMinFeeLamports();
  const maxFee = getMaxFeeLamports();

  if (inputMint === SOL_MINT) {
    const bpsCalc = (amount * BigInt(feeBps)) / 10_000n;
    const clamped =
      bpsCalc < minFee ? minFee : bpsCalc > maxFee ? maxFee : bpsCalc;
    return {
      feeLamports: clamped,
      basis: bpsCalc < minFee
        ? 'minimum_floor'
        : bpsCalc > maxFee
        ? 'maximum_cap'
        : 'bps_of_sol_input',
    };
  }

  // SPL token input: use flat minimum (no price feed in v0)
  return { feeLamports: minFee, basis: 'flat_minimum_non_sol_input' };
}

// ── Handler ───────────────────────────────────────────────────────────────────

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
  const { allowed, remaining, resetAt } = checkRateLimitByIp(
    ip,
    'manual-fee-quote',
    RATE_LIMIT,
  );

  const fail = (
    msg: string,
    status = 400,
    code?: string,
    details?: Record<string, unknown>,
  ) => {
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

  if (!allowed)
    return fail(
      `Rate limit. Retry in ${Math.ceil((resetAt - Date.now()) / 1000)}s`,
      429,
      'RATE_LIMIT',
    );

  const { searchParams } = new URL(req.url);
  const raw = {
    inputMint: searchParams.get('inputMint')?.trim(),
    outputMint: searchParams.get('outputMint')?.trim(),
    amount: searchParams.get('amount')?.trim(),
    userPublicKey: searchParams.get('userPublicKey')?.trim(),
    quoteUsdValue: searchParams.get('quoteUsdValue')?.trim() ?? undefined,
  };

  const parsed = QuoteSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Validation failed');
  }

  const { inputMint, outputMint, amount, userPublicKey, quoteUsdValue } =
    parsed.data;

  // Resolve fee config
  let feeWallet: string;
  try {
    feeWallet = getFeeWallet();
  } catch {
    return fail(
      'Manual fee wallet is not configured.',
      500,
      'MANUAL_FEE_QUOTE_UNAVAILABLE',
      { reason: 'fee_wallet_config_error' },
    );
  }

  const feeBps = getManualFeeBps();
  const ttlSeconds = getQuoteTtlSeconds();

  let feeLamports: bigint;
  let basis: string;
  try {
    const result = calculateFeeLamports(inputMint, BigInt(amount), quoteUsdValue);
    feeLamports = result.feeLamports;
    basis = result.basis;
  } catch {
    return fail(
      'Could not calculate manual fee for this swap.',
      500,
      'MANUAL_FEE_QUOTE_UNAVAILABLE',
      { reason: 'fee_calculation_error' },
    );
  }

  const now = Date.now();
  const expiresAt = new Date(now + ttlSeconds * 1000).toISOString();
  const memo = `bags-shield:${requestId}`;

  console.log(
    JSON.stringify({
      level: 'info',
      event: 'manual_fee_quote',
      requestId,
      inputMint,
      outputMint,
      amount,
      userPublicKey,
      feeLamports: feeLamports.toString(),
      feeBps,
      basis,
      feeWallet,
    }),
  );

  const res = NextResponse.json(
    {
      success: true,
      response: {
        manualFeeRequired: true,
        feeMode: 'manual_sol_transfer',
        feeBps,
        feeLamports: feeLamports.toString(),
        feeWallet,
        memo,
        reason:
          'Jupiter referral fee was not applied; manual fee is required to avoid zero-fee execution.',
        expiresAt,
        ttlSeconds,
        basis,
        verifyEndpoint: '/api/swap/manual-fee/verify',
        _note:
          'Send a SOL transfer of at least feeLamports to feeWallet. Include memo in a Memo Program instruction. Then POST to verifyEndpoint before executing the swap.',
      },
      meta: { requestId },
    },
    {
      status: 200,
      headers: {
        'X-Request-Id': requestId,
        'Cache-Control': 'no-store',
      },
    },
  );
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set('X-RateLimit-Remaining', String(remaining - 1));
  return res;
}
