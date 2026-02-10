/**
 * POST /api/swap Ã¢â‚¬â€ Jupiter swapTransaction builder (server returns tx base64; wallet signs+sends).
 * Body: { quoteResponse, userPublicKey, wrapAndUnwrapSol?, dynamicComputeUnitLimit?, prioritizationFeeLamports?, asLegacyTransaction? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getOrGenerateRequestId, applyCorsHeaders, applyNoStore, applySecurityHeaders } from '@/lib/security';
import { checkRateLimitByIp, getClientIp } from '@/lib/security/rateLimit';
import { LaunchpadValidator } from '@/lib/security/validate';
import { fetchJupiterSwap } from '@/lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);
  const res = new NextResponse(null, { status: 204 });

  // Preflight precisa CORS pra navegador liberar o POST.
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set('X-Request-Id', requestId);

  return res;
}


const RATE_LIMIT = { windowMs: 60_000, max: 15 };

// Ã¢â‚¬Å“SwitchÃ¢â‚¬Â de seguranÃƒÂ§a: sÃƒÂ³ liga trade real quando vocÃƒÂª setar env no Vercel
const TRADING_ENABLED = (process.env.BETA_TRADING_ENABLED ?? '').trim().toLowerCase() === 'true';

// Guardrail opcional (super recomendado no beta):
// limite mÃƒÂ¡ximo de inAmount (em unidades mÃƒÂ­nimas do token).
// default bem conservador pra evitar Ã¢â‚¬Å“oopsÃ¢â‚¬Â.
const MAX_IN_AMOUNT = BigInt((process.env.SWAP_MAX_IN_AMOUNT ?? '50000000').trim()); // ex: 0.05 SOL em lamports
const MAX_SLIPPAGE_BPS = Number((process.env.SWAP_MAX_SLIPPAGE_BPS ?? '500').trim()); // 5%

const SwapBodySchema = z
  .object({
    userPublicKey: z
      .string()
      .trim()
      .min(32)
      .max(44)
      .refine((v) => LaunchpadValidator.validateMint(v).valid, 'invalid userPublicKey'),
    quoteResponse: z
      .object({
        inputMint: z.string().trim().min(32).max(44),
        outputMint: z.string().trim().min(32).max(44),
        inAmount: z.string().trim().min(1).max(40),
        // slippageBps existe em alguns retornos; se vier, validamos.
        slippageBps: z.coerce.number().optional(),
      })
      .passthrough(),
    wrapAndUnwrapSol: z.boolean().optional().default(true),
    dynamicComputeUnitLimit: z.boolean().optional().default(true),
    prioritizationFeeLamports: z.union([z.number().int().min(0).max(5_000_000), z.literal('auto')]).optional(),
    asLegacyTransaction: z.boolean().optional().default(false),
  })
  .strict();

export async function POST(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);
  const ip = getClientIp(req.headers);
  const { allowed, remaining, resetAt } = checkRateLimitByIp(ip, 'swap', RATE_LIMIT);

  if (!allowed) {
    const retry = Math.ceil((resetAt - Date.now()) / 1000);
    const res = NextResponse.json(
      {
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many swap requests.', retryAfter: retry },
        meta: { requestId },
      },
      { status: 429, headers: { 'X-Request-Id': requestId, 'Retry-After': String(retry) } },
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    return res;
  }

  if (!TRADING_ENABLED) {
    const res = NextResponse.json(
      {
        success: false,
        error: { code: 'BETA_TRADING_DISABLED', message: 'Trading is disabled (set BETA_TRADING_ENABLED=true).' },
        meta: { requestId },
      },
      { status: 503, headers: { 'X-Request-Id': requestId } },
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    return res;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const res = NextResponse.json(
      { success: false, error: 'Invalid JSON body', meta: { requestId } },
      { status: 400, headers: { 'X-Request-Id': requestId } },
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    return res;
  }

  const parsed = SwapBodySchema.safeParse(body);
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

  const { quoteResponse } = parsed.data;

  // Guardrails (beta): inAmount <= MAX_IN_AMOUNT
  let inAmount = BigInt(0);
  try {
    inAmount = BigInt(String((quoteResponse as any).inAmount ?? '0'));
  } catch {
    const res = NextResponse.json(
      { success: false, error: 'Invalid quoteResponse.inAmount', meta: { requestId } },
      { status: 400, headers: { 'X-Request-Id': requestId } },
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    return res;
  }

  if (inAmount <= 0n) {
    const res = NextResponse.json(
      { success: false, error: 'inAmount must be > 0', meta: { requestId } },
      { status: 400, headers: { 'X-Request-Id': requestId } },
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    return res;
  }

  if (inAmount > MAX_IN_AMOUNT) {
    const res = NextResponse.json(
      {
        success: false,
        error: {
          code: 'AMOUNT_TOO_LARGE',
          message: `inAmount exceeds beta limit (MAX_IN_AMOUNT=${MAX_IN_AMOUNT.toString()})`,
        },
        meta: { requestId },
      },
      { status: 400, headers: { 'X-Request-Id': requestId } },
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    return res;
  }

  const slippageBps = Number((quoteResponse as any).slippageBps ?? 0);
  if (slippageBps && slippageBps > MAX_SLIPPAGE_BPS) {
    const res = NextResponse.json(
      {
        success: false,
        error: { code: 'SLIPPAGE_TOO_HIGH', message: `slippageBps>${MAX_SLIPPAGE_BPS} not allowed in beta` },
        meta: { requestId },
      },
      { status: 400, headers: { 'X-Request-Id': requestId } },
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    return res;
  }

  const d = parsed.data;

  if (!d.userPublicKey || !d.quoteResponse) {
    const res = NextResponse.json(
      {
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Missing userPublicKey or quoteResponse' },
        meta: { requestId },
      },
      { status: 400, headers: { 'X-Request-Id': requestId } },
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    return res;
  }

  const result = await fetchJupiterSwap({
    userPublicKey: d.userPublicKey,
    quoteResponse: d.quoteResponse,
    wrapAndUnwrapSol: d.wrapAndUnwrapSol,
    dynamicComputeUnitLimit: d.dynamicComputeUnitLimit,
    prioritizationFeeLamports: d.prioritizationFeeLamports,
    asLegacyTransaction: d.asLegacyTransaction,
  });

  if (!result.ok) {
    const res = NextResponse.json(
      { success: false, error: result.error ?? 'Swap build failed', meta: { requestId, source: 'jupiter' } },
      { status: 502, headers: { 'X-Request-Id': requestId } },
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    return res;
  }

  const res = NextResponse.json(
    { success: true, response: result.data, meta: { requestId, latencyMs: result.latencyMs, source: 'jupiter' } },
    { status: 200, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } },
  );
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set('X-RateLimit-Remaining', String(remaining - 1));
  return res;
}

