/**
 * POST /api/v0/swap/quote
 * Endpoint unificado para cotação de swap (contrato único)
 */

import { NextRequest, NextResponse } from 'next/server';
import { swapRouter } from '@/lib/swap-router';
import { setCors, preflight, guardMethod, noStore, newRequestId } from '@/lib/cors-next';

export async function POST(req: NextRequest) {
  const preflightRes = preflight(req);
  if (preflightRes) return preflightRes;

  const methodCheck = guardMethod(req, ['POST']);
  if (!methodCheck.allowed) return methodCheck.response!;

  const requestId = newRequestId();
  let res = NextResponse.json({ success: true, response: {}, meta: { requestId } });
  res = setCors(noStore(res));
  res.headers.set('X-Request-Id', requestId);

  try {
    const body = await req.json().catch(() => ({}));
    const { inputMint, outputMint, amount, slippageBps, swapMode, userOptOut, tier, wantsPremium } = body || {};

    const result = await swapRouter.getQuote(
      {
        inputMint,
        outputMint,
        amount: String(amount),
        slippageBps,
        swapMode,
        userOptOut,
        tier,
        wantsPremium,
      },
      requestId,
    );

    if (result.success) {
      return NextResponse.json(result, { headers: res.headers });
    } else {
      // Erro estruturado (NO_ROUTE, PROVIDER_ERROR, INVALID_PARAMS)
      return NextResponse.json(result, {
        status: result.error === 'INVALID_PARAMS' ? 400 : 500,
        headers: res.headers,
      });
    }
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'PROVIDER_ERROR',
        details: {
          providerTried: [],
          reason: e?.message || 'Unexpected error',
          nextActions: ['try_again_later'],
        },
        meta: { requestId },
      },
      { status: 500, headers: res.headers },
    );
  }
}
