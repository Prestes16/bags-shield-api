/**
 * POST /api/v0/jup/swap
 * Endpoint v0 para construir transação Jupiter Swap
 */

import { NextRequest, NextResponse } from 'next/server';
import { postSwap } from '@/lib/jup';
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
      quoteResponse,
      userPublicKey,
      feeAccount: userFeeAccount,
      trackingAccount: userTrackingAccount,
      userOptOut,
      tier,
      wantsPremium,
    } = body || {};

    if (!quoteResponse || !userPublicKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'missing_params',
          message: 'quoteResponse e userPublicKey são obrigatórios',
          meta: { requestId },
        },
        { status: 400 },
      );
    }

    // Decisão de fee (usar outputMint do quote se não vier override)
    const outputMint = quoteResponse?.outputMint || '';
    const feeDecision =
      userFeeAccount !== undefined || userTrackingAccount !== undefined
        ? {
            feeBps: quoteResponse?.platformFeeBps || 0,
            trackingAccount: userTrackingAccount || '',
            feeAccount: userFeeAccount,
            reasons: ['userOverride'],
          }
        : getFeeDecision({
            userOptOut: userOptOut ?? false,
            tier: tier ?? 'free',
            wantsPremium: wantsPremium ?? false,
            outputMint,
          });

    const swap = await postSwap({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      feeAccount: feeDecision.feeAccount,
      trackingAccount: feeDecision.trackingAccount || userTrackingAccount,
    });

    return NextResponse.json(
      {
        success: true,
        response: swap,
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
        error: e?.message || 'swap_failed',
        meta: { requestId },
      },
      { status: 500, headers: res.headers },
    );
  }
}
