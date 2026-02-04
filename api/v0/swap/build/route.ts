/**
 * POST /api/v0/swap/build
 * Endpoint unificado para construir transação de swap (contrato único)
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
    const { quoteResponse, userPublicKey, feeAccount, trackingAccount } = body || {};

    const result = await swapRouter.buildSwap(
      {
        quoteResponse,
        userPublicKey,
        feeAccount,
        trackingAccount,
      },
      requestId,
    );

    if (result.success) {
      return NextResponse.json(result, { headers: res.headers });
    } else {
      // Erro estruturado (BUILD_FAILED, INVALID_PARAMS)
      return NextResponse.json(result, {
        status: result.error === 'INVALID_PARAMS' ? 400 : 500,
        headers: res.headers,
      });
    }
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'BUILD_FAILED',
        details: {
          providerTried: [],
          reason: e?.message || 'Unexpected error',
        },
        meta: { requestId },
      },
      { status: 500, headers: res.headers },
    );
  }
}
