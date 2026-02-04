/**
 * GET /api/token/[mint]
 *
 * Retorna informações do token (metadata + security scan)
 * Útil para o dashboard que precisa de dados do token por mint
 */

import { NextRequest, NextResponse } from 'next/server';
import { trackApiError } from '@/lib/error-tracking';

export async function GET(request: NextRequest, { params }: { params: { mint: string } }) {
  const requestId = crypto.randomUUID();
  const mint = params.mint;

  try {
    // TODO: Buscar metadata do token via Helius DAS API
    // Por enquanto, retornamos estrutura básica

    // Estrutura de resposta compatível com TokenDashboard (tokenInfo, security, integrity)
    const response = {
      success: true,
      response: {
        tokenInfo: {
          name: 'Token', // TODO: Buscar do Helius DAS API
          symbol: 'TOKEN', // TODO: Buscar do Helius DAS API
          image: '', // TODO: Buscar do Helius DAS API (content.links.image)
          mint: mint,
        },
        security: {
          score: 80, // TODO: Fazer scan real do token
          isSafe: true, // TODO: Determinar baseado no scan
          mintAuthority: false, // TODO: Do scan real
          freezeAuthority: false,
          lpLocked: true, // LP locked = mais seguro
        },
        integrity: { isVerified: false }, // TODO: Verificação Bags/Helius
      },
      meta: { requestId },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    trackApiError(error, request as any, {
      endpoint: `/api/token/${mint}`,
      source: 'token',
      requestId,
      metadata: { mint },
    });

    console.error(`[token/${mint}] Error:`, error?.message || String(error));

    return NextResponse.json(
      {
        success: false,
        error: 'token_fetch_failed',
        message: error?.message || 'Failed to fetch token information',
        meta: { requestId },
      },
      { status: 500 },
    );
  }
}
