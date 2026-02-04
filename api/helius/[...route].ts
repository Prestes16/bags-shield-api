import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCors, preflight, guardMethod, noStore, ensureRequestId } from '../../lib/cors';
import { heliusClient, isHeliusAvailable } from '../../lib/helius';
import { trackHeliusApiError, trackApiError } from '../../lib/error-tracking';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void | VercelResponse> {
  const requestId = ensureRequestId(res);

  try {
    setCors(res, req);
    if (req.method === 'OPTIONS') {
      return preflight(res, ['POST', 'GET'], ['Content-Type', 'Authorization', 'x-api-key'], req);
    }

    if (!guardMethod(req, res, ['POST', 'GET'])) return;
    noStore(res);

    // Verifica se Helius está configurado
    if (!isHeliusAvailable()) {
      return res.status(501).json({
        success: false,
        error: 'helius_not_configured',
        message: 'HELIUS_API_KEY não está configurada. Configure a variável de ambiente HELIUS_API_KEY.',
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
    if (path === 'simulate' || path === 'simulate-transaction') {
      return handleSimulateTransaction(req, res, body, requestId);
    }

    if (path === 'transaction' || path === 'get-transaction') {
      return handleGetTransaction(req, res, body, requestId);
    }

    if (path === 'transactions' || path === 'get-transactions') {
      return handleGetTransactions(req, res, body, requestId);
    }

    if (path === 'account' || path === 'get-account-info') {
      return handleGetAccountInfo(req, res, body, requestId);
    }

    if (path === 'balance' || path === 'get-balance') {
      return handleGetBalance(req, res, body, requestId);
    }

    if (path === 'slot' || path === 'get-slot') {
      return handleGetSlot(req, res, requestId);
    }

    if (path === 'block' || path === 'get-block') {
      return handleGetBlock(req, res, body, requestId);
    }

    // Enhanced Transactions API: analisar transação(ões)
    if (path === 'parse-transactions' || path === 'enhanced-transactions') {
      return handleParseTransactions(req, res, body, requestId);
    }

    // Enhanced Transactions API: histórico por endereço (query ?address=...)
    if (path === 'address-transactions') {
      return handleAddressTransactions(req, res, requestId);
    }

    // GET /api/helius/addresses/{address}/transactions
    if (path.startsWith('addresses/') && path.endsWith('/transactions')) {
      const address = path.slice('addresses/'.length, -'/transactions'.length);
      if (address) return handleAddressTransactionsByPath(req, res, address, requestId);
    }

    // Rota não encontrada
    return res.status(404).json({
      success: false,
      error: 'route_not_found',
      message: `Rota Helius não encontrada: ${path || '(raiz)'}`,
      availableRoutes: [
        'simulate',
        'transaction',
        'transactions',
        'account',
        'balance',
        'slot',
        'block',
        'parse-transactions',
        'address-transactions',
        'addresses/{address}/transactions',
      ],
      meta: { requestId },
    });
  } catch (error: any) {
    trackApiError(error, req, {
      endpoint: `/api/helius/${req.query.route || ''}`,
      source: 'helius',
    });

    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: 'helius_api_error',
      message: isDev ? error?.message || String(error) : 'Erro interno ao processar requisição Helius',
      meta: { requestId },
    });
  }
}

/**
 * POST /api/helius/simulate
 * Simula uma transação
 */
async function handleSimulateTransaction(
  req: VercelRequest,
  res: VercelResponse,
  body: any,
  requestId: string,
): Promise<void> {
  try {
    const transaction = body.transaction || body.tx || body.transactionBase64;
    if (!transaction || typeof transaction !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_transaction',
        message: "Campo 'transaction' (base64) é obrigatório",
        meta: { requestId },
      });
    }

    const options = {
      replaceRecentBlockhash: body.replaceRecentBlockhash ?? true,
      commitment: body.commitment || 'confirmed',
      sigVerify: body.sigVerify ?? false,
    };

    const result = await heliusClient.simulateTransaction(transaction, options, requestId);

    return res.status(200).json({
      success: true,
      response: result.result,
      meta: {
        requestId,
        upstream: 'helius',
        upstreamStatus: 200,
      },
    });
  } catch (error: any) {
    trackHeliusApiError(error, req, {
      endpoint: '/api/helius/simulate',
      requestId,
      metadata: { hasTransaction: !!body.transaction },
    });

    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: 'simulate_failed',
      message: isDev ? error?.message || String(error) : 'Falha ao simular transação',
      meta: { requestId },
    });
  }
}

/**
 * POST /api/helius/transaction
 * Obtém informações de uma transação
 */
async function handleGetTransaction(
  req: VercelRequest,
  res: VercelResponse,
  body: any,
  requestId: string,
): Promise<void> {
  try {
    const signature = body.signature || body.sig;
    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_signature',
        message: "Campo 'signature' é obrigatório",
        meta: { requestId },
      });
    }

    const options = {
      commitment: body.commitment || 'confirmed',
      maxSupportedTransactionVersion: body.maxSupportedTransactionVersion || 0,
    };

    const result = await heliusClient.getTransaction(signature, options, requestId);

    return res.status(200).json({
      success: true,
      response: result.result,
      meta: {
        requestId,
        upstream: 'helius',
        upstreamStatus: 200,
      },
    });
  } catch (error: any) {
    trackHeliusApiError(error, req, {
      endpoint: '/api/helius/transaction',
      requestId,
      metadata: { hasSignature: !!body.signature },
    });

    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: 'get_transaction_failed',
      message: isDev ? error?.message || String(error) : 'Falha ao obter transação',
      meta: { requestId },
    });
  }
}

/**
 * POST /api/helius/transactions
 * Obtém informações de múltiplas transações
 */
async function handleGetTransactions(
  req: VercelRequest,
  res: VercelResponse,
  body: any,
  requestId: string,
): Promise<void> {
  try {
    const signatures = body.signatures || body.sigs || [];
    if (!Array.isArray(signatures) || signatures.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'missing_signatures',
        message: "Campo 'signatures' (array) é obrigatório",
        meta: { requestId },
      });
    }

    const options = {
      commitment: body.commitment || 'confirmed',
      maxSupportedTransactionVersion: body.maxSupportedTransactionVersion || 0,
    };

    const result = await heliusClient.getTransactions(signatures, options, requestId);

    return res.status(200).json({
      success: true,
      response: result.result,
      meta: {
        requestId,
        upstream: 'helius',
        upstreamStatus: 200,
      },
    });
  } catch (error: any) {
    trackHeliusApiError(error, req, {
      endpoint: '/api/helius/transactions',
      requestId,
      metadata: { signaturesCount: body.signatures?.length || 0 },
    });

    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: 'get_transactions_failed',
      message: isDev ? error?.message || String(error) : 'Falha ao obter transações',
      meta: { requestId },
    });
  }
}

/**
 * POST /api/helius/account
 * Obtém informações de uma conta
 */
async function handleGetAccountInfo(
  req: VercelRequest,
  res: VercelResponse,
  body: any,
  requestId: string,
): Promise<void> {
  try {
    const address = body.address || body.account;
    if (!address || typeof address !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_address',
        message: "Campo 'address' é obrigatório",
        meta: { requestId },
      });
    }

    const options = {
      encoding: body.encoding || 'jsonParsed',
      commitment: body.commitment || 'confirmed',
    };

    const result = await heliusClient.getAccountInfo(address, options, requestId);

    return res.status(200).json({
      success: true,
      response: result.result,
      meta: {
        requestId,
        upstream: 'helius',
        upstreamStatus: 200,
      },
    });
  } catch (error: any) {
    trackHeliusApiError(error, req, {
      endpoint: '/api/helius/account',
      requestId,
      metadata: { hasAddress: !!body.address },
    });

    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: 'get_account_info_failed',
      message: isDev ? error?.message || String(error) : 'Falha ao obter informações da conta',
      meta: { requestId },
    });
  }
}

/**
 * POST /api/helius/balance
 * Obtém o saldo de uma conta
 */
async function handleGetBalance(req: VercelRequest, res: VercelResponse, body: any, requestId: string): Promise<void> {
  try {
    const address = body.address || body.account;
    if (!address || typeof address !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_address',
        message: "Campo 'address' é obrigatório",
        meta: { requestId },
      });
    }

    const commitment = body.commitment || 'confirmed';
    const result = await heliusClient.getBalance(address, commitment, requestId);

    return res.status(200).json({
      success: true,
      response: {
        balance: result.result,
        lamports: result.result,
        sol: result.result ? result.result / 1_000_000_000 : 0,
      },
      meta: {
        requestId,
        upstream: 'helius',
        upstreamStatus: 200,
      },
    });
  } catch (error: any) {
    trackHeliusApiError(error, req, {
      endpoint: '/api/helius/balance',
      requestId,
      metadata: { hasAddress: !!body.address },
    });

    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: 'get_balance_failed',
      message: isDev ? error?.message || String(error) : 'Falha ao obter saldo',
      meta: { requestId },
    });
  }
}

/**
 * GET /api/helius/slot
 * Obtém o slot atual
 */
async function handleGetSlot(req: VercelRequest, res: VercelResponse, requestId: string): Promise<void> {
  try {
    const result = await heliusClient.getSlot(requestId);

    return res.status(200).json({
      success: true,
      response: {
        slot: result.result,
      },
      meta: {
        requestId,
        upstream: 'helius',
        upstreamStatus: 200,
      },
    });
  } catch (error: any) {
    trackHeliusApiError(error, req, {
      endpoint: '/api/helius/slot',
      requestId,
    });

    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: 'get_slot_failed',
      message: isDev ? error?.message || String(error) : 'Falha ao obter slot',
      meta: { requestId },
    });
  }
}

/**
 * POST /api/helius/block
 * Obtém informações de um bloco
 */
async function handleGetBlock(req: VercelRequest, res: VercelResponse, body: any, requestId: string): Promise<void> {
  try {
    const slot = body.slot;
    if (typeof slot !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'missing_slot',
        message: "Campo 'slot' (número) é obrigatório",
        meta: { requestId },
      });
    }

    const options = {
      encoding: body.encoding || 'json',
      transactionDetails: body.transactionDetails || 'full',
      maxSupportedTransactionVersion: body.maxSupportedTransactionVersion || 0,
    };

    const result = await heliusClient.getBlock(slot, options, requestId);

    return res.status(200).json({
      success: true,
      response: result.result,
      meta: {
        requestId,
        upstream: 'helius',
        upstreamStatus: 200,
      },
    });
  } catch (error: any) {
    trackHeliusApiError(error, req, {
      endpoint: '/api/helius/block',
      requestId,
      metadata: { hasSlot: typeof body.slot === 'number' },
    });

    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: 'get_block_failed',
      message: isDev ? error?.message || String(error) : 'Falha ao obter bloco',
      meta: { requestId },
    });
  }
}

/**
 * POST /api/helius/parse-transactions
 * Analisar transação(ões) – Enhanced Transactions API
 * Body: { "transactions": ["signature1", "signature2"], "commitment": "finalized" (opcional) }
 */
async function handleParseTransactions(
  req: VercelRequest,
  res: VercelResponse,
  body: any,
  requestId: string,
): Promise<void> {
  try {
    const transactions = body.transactions ?? body.signatures ?? body.sigs;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'missing_transactions',
        message: "Campo 'transactions' (array de signatures) é obrigatório",
        meta: { requestId },
      });
    }
    if (transactions.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'too_many_transactions',
        message: 'Máximo 100 transações por requisição',
        meta: { requestId },
      });
    }
    const commitment = body.commitment === 'confirmed' ? 'confirmed' : 'finalized';
    const result = await heliusClient.getEnhancedTransactions(transactions, { commitment }, requestId);
    return res.status(200).json({
      success: true,
      response: result,
      meta: {
        requestId,
        upstream: 'helius',
        upstreamStatus: 200,
        enhancedApi: true,
      },
    });
  } catch (error: any) {
    trackHeliusApiError(error, req, {
      endpoint: '/api/helius/parse-transactions',
      requestId,
      metadata: { hasTransactions: !!body.transactions?.length },
    });
    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: 'parse_transactions_failed',
      message: isDev ? error?.message || String(error) : 'Falha ao analisar transações',
      meta: { requestId },
    });
  }
}

/**
 * GET /api/helius/address-transactions?address=...&limit=100&...
 * Histórico de transações de um endereço – Enhanced Transactions API
 */
async function handleAddressTransactions(req: VercelRequest, res: VercelResponse, requestId: string): Promise<void> {
  const address = (req.query.address as string) || (req.query.addr as string);
  if (!address || typeof address !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'missing_address',
      message: "Query 'address' é obrigatória",
      meta: { requestId },
    });
  }
  return handleAddressTransactionsByPath(req, res, address, requestId);
}

/**
 * GET /api/helius/addresses/{address}/transactions?limit=100&...
 * Histórico de transações por path – Enhanced Transactions API
 */
async function handleAddressTransactionsByPath(
  req: VercelRequest,
  res: VercelResponse,
  address: string,
  requestId: string,
): Promise<void> {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 100);
    const options = {
      limit,
      before: (req.query.before as string) || undefined,
      after: (req.query.after as string) || undefined,
      commitment: (req.query.commitment as 'finalized' | 'confirmed') || undefined,
      sortOrder: (req.query['sort-order'] ?? req.query.sortOrder) as 'asc' | 'desc' | undefined,
      type: (req.query.type as string) || undefined,
      source: (req.query.source as string) || undefined,
      gtSlot: req.query['gt-slot'] != null ? Number(req.query['gt-slot']) : undefined,
      gteSlot: req.query['gte-slot'] != null ? Number(req.query['gte-slot']) : undefined,
      ltSlot: req.query['lt-slot'] != null ? Number(req.query['lt-slot']) : undefined,
      lteSlot: req.query['lte-slot'] != null ? Number(req.query['lte-slot']) : undefined,
      gtTime: req.query['gt-time'] != null ? Number(req.query['gt-time']) : undefined,
      gteTime: req.query['gte-time'] != null ? Number(req.query['gte-time']) : undefined,
      ltTime: req.query['lt-time'] != null ? Number(req.query['lt-time']) : undefined,
      lteTime: req.query['lte-time'] != null ? Number(req.query['lte-time']) : undefined,
    };
    const result = await heliusClient.getAddressTransactions(address, options, requestId);
    return res.status(200).json({
      success: true,
      response: result,
      meta: {
        requestId,
        upstream: 'helius',
        upstreamStatus: 200,
        enhancedApi: true,
        address,
      },
    });
  } catch (error: any) {
    trackHeliusApiError(error, req, {
      endpoint: '/api/helius/address-transactions',
      requestId,
      metadata: { address },
    });
    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: 'address_transactions_failed',
      message: isDev ? error?.message || String(error) : 'Falha ao obter histórico de transações',
      meta: { requestId },
    });
  }
}
