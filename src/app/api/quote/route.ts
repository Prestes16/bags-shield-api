/**
 * GET /api/quote — Jupiter quote with rate limit and guardrails.
 * Query: inputMint, outputMint, amount, slippageBps (optional, default 50).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOrGenerateRequestId, applyCorsHeaders, applyNoStore, applySecurityHeaders } from '@/lib/security';
import { fetchJupiterQuote } from '@/lib/providers';
import { checkRateLimitByIp, getClientIp } from '@/lib/security/rateLimit';
import { LaunchpadValidator } from '@/lib/security/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuoteParamsSchema = z
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
    amount: z.string().trim().min(1).max(30),
    slippageBps: z.coerce.number().min(1).max(5000).optional().default(50),
  })
  .strict();

const RATE_LIMIT = { windowMs: 60_000, max: 30 };

export async function GET(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);
  const ip = getClientIp(req.headers);
  const { allowed, remaining, resetAt } = checkRateLimitByIp(ip, 'quote', RATE_LIMIT);

  if (!allowed) {
    const res = NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many quote requests.',
          retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
        },
      },
      {
        status: 429,
        headers: { 'X-Request-Id': requestId, 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) },
      },
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    return res;
  }

  const { searchParams } = new URL(req.url);
  const raw = {
    inputMint: searchParams.get('inputMint')?.trim(),
    outputMint: searchParams.get('outputMint')?.trim(),
    amount: searchParams.get('amount')?.trim(),
    slippageBps: searchParams.get('slippageBps') ? Number(searchParams.get('slippageBps')) : undefined,
  };

  const parsed = QuoteParamsSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Validation failed';
    const res = NextResponse.json(
      { success: false, error: msg, meta: { requestId } },
      { status: 400, headers: { 'X-Request-Id': requestId } },
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    return res;
  }

  const { inputMint, outputMint, amount, slippageBps } = parsed.data;
  const result = await fetchJupiterQuote({
    inputMint: inputMint!,
    outputMint: outputMint!,
    amount: amount!,
    slippageBps,
  });

  if (!result.ok) {
    const res = NextResponse.json(
      {
        success: false,
        error: result.error ?? 'Quote failed',
        meta: { requestId, source: 'jupiter' },
      },
      { status: 502, headers: { 'X-Request-Id': requestId } },
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    return res;
  }

  const res = NextResponse.json(
    {
      success: true,
      response: result.data,
      meta: { requestId, latencyMs: result.latencyMs },
    },
    { status: 200, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } },
  );
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set('X-RateLimit-Remaining', String(remaining - 1));
  return res;
}
