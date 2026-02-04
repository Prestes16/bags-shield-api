/**
 * POST /api/v0/jup/quote
 * Endpoint v0 para cotação Jupiter Swap
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQuote } from '@/lib/jup';
import { getFeeDecision } from '@/lib/economy';
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
    const {
      inputMint,
      outputMint,
      amount,
      slippageBps,
      swapMode,
      platformFeeBps: userPlatformFeeBps,
      userOptOut,
      tier,
      wantsPremium,
    } = body || {};

    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json(
        {
          success: false,
          error: 'missing_params',
          message: 'inputMint, outputMint e amount são obrigatórios',
          meta: { requestId },
        },
        { status: 400 },
      );
    }

    // Decisão de fee (se não vier override do user)
    const feeDecision =
      userPlatformFeeBps !== undefined
        ? { feeBps: userPlatformFeeBps, trackingAccount: '', feeAccount: undefined, reasons: ['userOverride'] }
        : getFeeDecision({
            userOptOut: userOptOut ?? false,
            tier: tier ?? 'free',
            wantsPremium: wantsPremium ?? false,
            outputMint, // ExactIn: fee no outputMint
          });

    const quote = await getQuote({
      inputMint,
      outputMint,
      amount: String(amount),
      slippageBps: slippageBps ?? 50,
      swapMode: swapMode ?? 'ExactIn',
      platformFeeBps: feeDecision.feeBps,
    });

    return NextResponse.json(
      {
        success: true,
        response: quote,
        meta: {
          requestId,
          feeBps: feeDecision.feeBps,
          feeReasons: feeDecision.reasons,
        },
      },
      { headers: res.headers },
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        error: e?.message || 'quote_failed',
        meta: { requestId },
      },
      { status: 500, headers: res.headers },
    );
  }
}
