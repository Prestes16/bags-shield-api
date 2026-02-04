import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCors, preflight, guardMethod, noStore, ensureRequestId } from '../../lib/cors';
import { jupiterClient, isJupiterAvailable } from '../../lib/jupiter';
import { trackApiError } from '../../lib/error-tracking';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void | VercelResponse> {
  const requestId = ensureRequestId(res);

  try {
    setCors(res, req);
    if (req.method === 'OPTIONS') {
      return preflight(res, ['POST', 'GET'], ['Content-Type', 'Authorization', 'x-api-key'], req);
    }

    if (!guardMethod(req, res, ['POST', 'GET'])) return;
    noStore(res);

    // Verifica se Jupiter está configurado
    if (!isJupiterAvailable()) {
      return res.status(501).json({
        success: false,
        error: 'jupiter_not_configured',
        message: 'JUPITER_API_KEY não está configurada. Configure a variável de ambiente JUPITER_API_KEY.',
        meta: { requestId },
      });
    }

    // Extrai o path da rota
    const routeParam = req.query.route;
    let path = '';
    if (Array.isArray(routeParam)) {
      path = routeParam.map(String).filter(Boolean).join('/');
    } else if (routeParam) {
      path = String(routeParam);
    }

    // Parse body para POST
    let body: any = {};
    if (req.method === 'POST') {
      try {
        if (typeof req.body === 'string') {
          body = JSON.parse(req.body);
        } else if (req.body) {
          body = req.body;
        }
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'invalid_json',
          message: 'Corpo da requisição não é um JSON válido',
          meta: { requestId },
        });
      }
    }

    // Roteamento de endpoints
    if (path === 'quote' || path === 'get-quote') {
      return handleGetQuote(req, res, requestId);
    }

    if (path === 'swap' || path === 'build-swap') {
      return handleBuildSwap(req, res, body, requestId);
    }

    if (path === 'swap-instructions' || path === 'instructions') {
      return handleBuildSwapInstructions(req, res, body, requestId);
    }

    if (path === 'price' || path === 'prices' || path === 'get-price') {
      return handleGetPrice(req, res, requestId);
    }

    // Rota não encontrada
    return res.status(404).json({
      success: false,
      error: 'route_not_found',
      message: `Rota Jupiter não encontrada: ${path || '(raiz)'}`,
      availableRoutes: ['quote', 'swap', 'swap-instructions', 'price'],
      meta: { requestId },
    });
  } catch (error: any) {
    trackApiError(error, req, {
      endpoint: `/api/jupiter/${req.query.route || ''}`,
      source: 'jupiter',
    });

    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: 'jupiter_api_error',
      message: isDev ? error?.message || String(error) : 'Erro interno ao processar requisição Jupiter',
      meta: { requestId },
    });
  }
}

/**
 * GET /api/jupiter/quote
 * Obter cotação de swap
 * Query: inputMint, outputMint, amount, slippageBps, etc.
 */
async function handleGetQuote(
  req: VercelRequest,
  res: VercelResponse,
  requestId: string,
): Promise<void | VercelResponse> {
  try {
    const inputMint = (req.query.inputMint as string) || (req.query.input_mint as string);
    const outputMint = (req.query.outputMint as string) || (req.query.output_mint as string);
    const amount = req.query.amount as string;

    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({
        success: false,
        error: 'missing_params',
        message: 'Parâmetros obrigatórios: inputMint, outputMint, amount',
        meta: { requestId },
      });
    }

    const params = {
      inputMint,
      outputMint,
      amount,
      slippageBps: req.query.slippageBps ? Number(req.query.slippageBps) : undefined,
      restrictIntermediateTokens: req.query.restrictIntermediateTokens === 'true',
      onlyDirectRoutes: req.query.onlyDirectRoutes === 'true',
      asLegacyTransaction: req.query.asLegacyTransaction === 'true',
      maxAccounts: req.query.maxAccounts ? Number(req.query.maxAccounts) : undefined,
      platformFeeBps: req.query.platformFeeBps ? Number(req.query.platformFeeBps) : undefined,
      feeAccount: req.query.feeAccount as string | undefined,
    };

    const quote = await jupiterClient.getQuote(params, requestId);

    return res.status(200).json({
      success: true,
      response: quote,
      meta: {
        requestId,
        upstream: 'jupiter',
        upstreamStatus: 200,
      },
    });
  } catch (error: any) {
    trackApiError(error, req, {
      endpoint: '/api/jupiter/quote',
      requestId,
      source: 'jupiter',
      metadata: {
        hasInputMint: !!req.query.inputMint,
        hasOutputMint: !!req.query.outputMint,
        hasAmount: !!req.query.amount,
      },
    });

    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: 'quote_failed',
      message: isDev ? error?.message || String(error) : 'Falha ao obter cotação de swap',
      meta: { requestId },
    });
  }
}

/**
 * POST /api/jupiter/swap
 * Construir transação de swap
 * Body: { quoteResponse, userPublicKey, ...opções }
 */
async function handleBuildSwap(
  req: VercelRequest,
  res: VercelResponse,
  body: any,
  requestId: string,
): Promise<void | VercelResponse> {
  try {
    const quoteResponse = body.quoteResponse || body.quote;
    const userPublicKey = body.userPublicKey || body.userPublicKey || body.wallet;

    if (!quoteResponse || !userPublicKey) {
      return res.status(400).json({
        success: false,
        error: 'missing_params',
        message: 'Parâmetros obrigatórios: quoteResponse, userPublicKey',
        meta: { requestId },
      });
    }

    const params = {
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: body.wrapAndUnwrapSol ?? true,
      useSharedAccounts: body.useSharedAccounts,
      feeAccount: body.feeAccount,
      trackingAccount: body.trackingAccount,
      dynamicComputeUnitLimit: body.dynamicComputeUnitLimit ?? true,
      dynamicSlippage: body.dynamicSlippage ?? true,
      prioritizationFeeLamports: body.prioritizationFeeLamports,
      asLegacyTransaction: body.asLegacyTransaction,
      useTokenLedger: body.useTokenLedger,
    };

    const swapResponse = await jupiterClient.buildSwapTransaction(params, requestId);

    return res.status(200).json({
      success: true,
      response: swapResponse,
      meta: {
        requestId,
        upstream: 'jupiter',
        upstreamStatus: 200,
      },
    });
  } catch (error: any) {
    trackApiError(error, req, {
      endpoint: '/api/jupiter/swap',
      requestId,
      source: 'jupiter',
      metadata: {
        hasQuoteResponse: !!body.quoteResponse,
        hasUserPublicKey: !!body.userPublicKey,
      },
    });

    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: 'swap_build_failed',
      message: isDev ? error?.message || String(error) : 'Falha ao construir transação de swap',
      meta: { requestId },
    });
  }
}

/**
 * POST /api/jupiter/swap-instructions
 * Obter instruções de swap (sem transação serializada)
 * Body: { quoteResponse, userPublicKey, ...opções }
 */
async function handleBuildSwapInstructions(
  req: VercelRequest,
  res: VercelResponse,
  body: any,
  requestId: string,
): Promise<void | VercelResponse> {
  try {
    const quoteResponse = body.quoteResponse || body.quote;
    const userPublicKey = body.userPublicKey || body.userPublicKey || body.wallet;

    if (!quoteResponse || !userPublicKey) {
      return res.status(400).json({
        success: false,
        error: 'missing_params',
        message: 'Parâmetros obrigatórios: quoteResponse, userPublicKey',
        meta: { requestId },
      });
    }

    const params = {
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: body.wrapAndUnwrapSol ?? true,
      useSharedAccounts: body.useSharedAccounts,
      feeAccount: body.feeAccount,
      trackingAccount: body.trackingAccount,
      asLegacyTransaction: body.asLegacyTransaction,
      useTokenLedger: body.useTokenLedger,
    };

    const instructions = await jupiterClient.buildSwapInstructions(params, requestId);

    return res.status(200).json({
      success: true,
      response: instructions,
      meta: {
        requestId,
        upstream: 'jupiter',
        upstreamStatus: 200,
      },
    });
  } catch (error: any) {
    trackApiError(error, req, {
      endpoint: '/api/jupiter/swap-instructions',
      requestId,
      source: 'jupiter',
      metadata: {
        hasQuoteResponse: !!body.quoteResponse,
        hasUserPublicKey: !!body.userPublicKey,
      },
    });

    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: 'swap_instructions_failed',
      message: isDev ? error?.message || String(error) : 'Falha ao obter instruções de swap',
      meta: { requestId },
    });
  }
}

/**
 * GET /api/jupiter/price
 * Obter preços de tokens (Price API V3)
 * Query: ids=mint1,mint2,... (máximo 50)
 */
async function handleGetPrice(
  req: VercelRequest,
  res: VercelResponse,
  requestId: string,
): Promise<void | VercelResponse> {
  try {
    const ids = (req.query.ids as string) || (req.query.mints as string);
    if (!ids) {
      return res.status(400).json({
        success: false,
        error: 'missing_ids',
        message: 'Query "ids" (mint addresses separados por vírgula) é obrigatória',
        meta: { requestId },
      });
    }

    const mintAddresses = ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (mintAddresses.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'invalid_ids',
        message: 'Nenhum mint address válido fornecido',
        meta: { requestId },
      });
    }

    if (mintAddresses.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'too_many_ids',
        message: 'Máximo 50 tokens por requisição',
        meta: { requestId },
      });
    }

    const prices = await jupiterClient.getPrices(mintAddresses, requestId);

    return res.status(200).json({
      success: true,
      response: prices,
      meta: {
        requestId,
        upstream: 'jupiter',
        upstreamStatus: 200,
        count: Object.keys(prices).length,
      },
    });
  } catch (error: any) {
    trackApiError(error, req, {
      endpoint: '/api/jupiter/price',
      requestId,
      source: 'jupiter',
      metadata: {
        hasIds: !!req.query.ids,
        idsCount: req.query.ids ? String(req.query.ids).split(',').length : 0,
      },
    });

    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: 'get_price_failed',
      message: isDev ? error?.message || String(error) : 'Falha ao obter preços de tokens',
      meta: { requestId },
    });
  }
}
