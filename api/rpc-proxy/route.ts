/**
 * RPC Proxy - Anti-Leak Pattern
 *
 * CRÍTICO: O frontend NUNCA deve chamar Helius diretamente com a chave privada.
 *
 * Este endpoint:
 * 1. Recebe requisições RPC do frontend (sem chave)
 * 2. Anexa HELIUS_API_KEY no servidor (seguro)
 * 3. Repassa para Helius RPC
 * 4. Retorna resposta ao frontend
 *
 * Isso garante que HELIUS_API_KEY nunca seja exposta ao cliente.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAndSanitize, rpcProxySchema } from '@/lib/security/validation-schemas';
import { trackHeliusApiError } from '@/lib/error-tracking';

const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || 'https://mainnet.helius-rpc.com';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';

/**
 * POST /api/rpc-proxy
 *
 * Proxy seguro para Helius RPC
 *
 * Body:
 * {
 *   method: "getBalance" | "getSlot" | ...,
 *   params: [...],
 *   id?: string | number
 * }
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // ========================================================================
    // 1. Validação e Sanitização (Anti-Manipulation)
    // ========================================================================
    const body = await request.json();
    const validated = await validateAndSanitize(rpcProxySchema, body);

    // ========================================================================
    // 2. Verificar se Helius está configurado
    // ========================================================================
    if (!HELIUS_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'helius_not_configured',
          message: 'HELIUS_API_KEY não está configurada no servidor',
        },
        { status: 501 },
      );
    }

    // ========================================================================
    // 3. Construir URL RPC com chave (no servidor, nunca exposta)
    // ========================================================================
    const rpcUrl = `${HELIUS_RPC_URL}/?api-key=${encodeURIComponent(HELIUS_API_KEY)}`;

    // ========================================================================
    // 4. Construir requisição RPC JSON-RPC 2.0
    // ========================================================================
    const rpcRequest = {
      jsonrpc: '2.0' as const,
      id: validated.id || requestId,
      method: validated.method,
      params: validated.params || [],
    };

    // ========================================================================
    // 5. Fazer requisição para Helius (servidor-side)
    // ========================================================================
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rpcRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      trackHeliusApiError(
        new Error(`Helius RPC error: ${response.status} - ${errorText}`),
        request as unknown as Request,
        {
          endpoint: '/api/rpc-proxy',
          requestId,
          metadata: {
            method: validated.method,
            status: response.status,
          },
        },
      );

      return NextResponse.json(
        {
          success: false,
          error: 'rpc_proxy_error',
          message: `Erro ao processar requisição RPC: ${response.status}`,
        },
        { status: response.status },
      );
    }

    const rpcResponse = await response.json();

    // ========================================================================
    // 6. Verificar erro RPC
    // ========================================================================
    if (rpcResponse.error) {
      trackHeliusApiError(new Error(`Helius RPC error: ${rpcResponse.error.message}`), request as unknown as Request, {
        endpoint: '/api/rpc-proxy',
        requestId,
        metadata: {
          method: validated.method,
          rpcError: rpcResponse.error,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: 'rpc_error',
          message: rpcResponse.error.message || 'Erro RPC desconhecido',
          rpcError: rpcResponse.error,
        },
        { status: 400 },
      );
    }

    // ========================================================================
    // 7. Retornar resposta (sem expor chave)
    // ========================================================================
    return NextResponse.json({
      success: true,
      response: rpcResponse.result,
      meta: {
        requestId,
        upstream: 'helius',
        upstreamStatus: response.status,
        method: validated.method,
      },
    });
  } catch (error) {
    // ========================================================================
    // 8. Tratamento de Erro
    // ========================================================================
    if (error instanceof Error && error.message.includes('Validação falhou')) {
      return NextResponse.json(
        {
          success: false,
          error: 'validation_error',
          message: error.message,
        },
        { status: 400 },
      );
    }

    trackHeliusApiError(error instanceof Error ? error : new Error(String(error)), request as unknown as Request, {
      endpoint: '/api/rpc-proxy',
      requestId,
    });

    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      {
        success: false,
        error: 'internal_error',
        message: isDev
          ? error instanceof Error
            ? error.message
            : String(error)
          : 'Erro interno ao processar requisição RPC',
      },
      { status: 500 },
    );
  }
}

/**
 * OPTIONS handler para CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
