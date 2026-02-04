/**
 * Integração com Jupiter API
 * Jupiter é um agregador de DEXes para Solana
 *
 * ⚠️ IMPORTANTE:
 * - lite-api.jup.ag será descontinuado em 31/01/2026 (já estamos usando api.jup.ag)
 * - Header x-api-key é OBRIGATÓRIO em todos os endpoints (quote, swap, instructions, price)
 *
 * Endpoints disponíveis:
 * - Swap API: https://api.jup.ag/swap/v1/ (quote, swap, swap-instructions)
 * - Price API V3: https://api.jup.ag/price/v3 (preços USD de tokens)
 */

import { trackApiError, trackJupiterApiError } from './error-tracking';

const JUPITER_API_BASE = process.env.JUPITER_API_BASE || 'https://api.jup.ag';
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || '';
const JUPITER_TIMEOUT_MS = Number(process.env.JUPITER_TIMEOUT_MS || 15_000);

export interface JupiterQuoteParams {
  inputMint: string; // Token mint address (ex: So11111111111111111111111111111111111111112 para SOL)
  outputMint: string; // Token mint address (ex: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v para USDC)
  amount: string | number; // Raw amount (lamports para SOL, atomic units para outros tokens)
  slippageBps?: number; // Basis points (ex: 50 = 0.5%, 100 = 1%)
  restrictIntermediateTokens?: boolean; // true para usar apenas tokens intermediários líquidos
  onlyDirectRoutes?: boolean; // true para rotas diretas apenas (1 mercado)
  asLegacyTransaction?: boolean; // true para transações legacy (sem versioned)
  maxAccounts?: number; // Limite de contas (recomendado: 64)
  platformFeeBps?: number; // Fee do integrador em basis points
  feeAccount?: string; // Conta para receber fees
  swapMode?: 'ExactIn' | 'ExactOut'; // Modo de swap: ExactIn (padrão) ou ExactOut
  dexes?: string[]; // Lista de DEXes para incluir (ex: ['Raydium', 'Orca'])
  excludeDexes?: string[]; // Lista de DEXes para excluir
  instructionVersion?: number; // Versão da instrução (0 = legacy, 1 = versioned)
}

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: 'ExactIn' | 'ExactOut';
  slippageBps: number;
  platformFee: any;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
}

export interface JupiterSwapParams {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string; // Wallet pública do usuário
  wrapAndUnwrapSol?: boolean; // true para wrap/unwrap SOL automaticamente
  useSharedAccounts?: boolean; // true para usar contas compartilhadas
  feeAccount?: string; // Conta para receber fees
  trackingAccount?: string; // Conta para tracking
  dynamicComputeUnitLimit?: boolean; // true para estimar compute units dinamicamente
  dynamicSlippage?: boolean; // true para ajustar slippage dinamicamente
  prioritizationFeeLamports?: {
    priorityLevelWithMaxLamports?: {
      maxLamports: number;
      priorityLevel: 'veryLow' | 'low' | 'medium' | 'high' | 'veryHigh';
    };
  };
  asLegacyTransaction?: boolean;
  useTokenLedger?: boolean;
}

export interface JupiterSwapResponse {
  swapTransaction: string; // Base64 encoded transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
  computeUnitLimit?: number;
  prioritizationType?: any;
  dynamicSlippageReport?: any;
  simulationError?: any;
}

export interface JupiterPriceResponse {
  [mintAddress: string]: {
    usdPrice: number;
    blockId: number;
    decimals: number;
    priceChange24h: number;
  };
}

class JupiterClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.apiKey = JUPITER_API_KEY;
    this.baseUrl = JUPITER_API_BASE;
    this.timeout = JUPITER_TIMEOUT_MS;
  }

  /**
   * Verifica se a API está configurada
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Requisição HTTP para Jupiter API
   */
  private async apiRequest<T = any>(
    method: 'GET' | 'POST',
    path: string,
    options: { body?: any; query?: Record<string, string | number | boolean | undefined> } = {},
    requestId?: string,
  ): Promise<T> {
    const searchParams = new URLSearchParams();
    if (options.query) {
      Object.entries(options.query).forEach(([k, v]) => {
        if (v !== undefined && v !== '') searchParams.set(k, String(v));
      });
    }
    const url = `${this.baseUrl}${path}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // x-api-key é OBRIGATÓRIO em todos os endpoints (quote, swap, instructions, price)
    if (!this.apiKey) {
      const error = new Error('JUPITER_API_KEY não está configurada. x-api-key é obrigatório em todos os endpoints.');
      trackJupiterApiError(error, {} as any, {
        requestId,
        endpoint: path,
        severity: 'high',
        metadata: { method },
      });
      throw error;
    }
    headers['x-api-key'] = this.apiKey;

    try {
      const init: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };
      if (method === 'POST' && options.body) {
        init.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, init);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Jupiter API error: ${response.status} - ${errorText}`);
        trackJupiterApiError(error, {} as any, {
          requestId,
          endpoint: path,
          metadata: { status: response.status, method },
        });
        throw error;
      }

      return (await response.json()) as T;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const timeoutError = new Error(`Jupiter API timeout após ${this.timeout}ms`);
        trackJupiterApiError(timeoutError, {} as any, {
          requestId,
          endpoint: path,
          severity: 'high',
          metadata: { timeout: this.timeout, method },
        });
        throw timeoutError;
      }
      if (err.message?.includes('Jupiter')) throw err;
      trackJupiterApiError(err, {} as any, {
        requestId,
        endpoint: path,
        severity: 'high',
        metadata: { method },
      });
      throw err;
    }
  }

  /**
   * Obter cotação de swap
   * GET /swap/v1/quote
   */
  async getQuote(params: JupiterQuoteParams, requestId?: string): Promise<JupiterQuoteResponse> {
    const query: Record<string, string | number | boolean | undefined> = {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: String(params.amount),
      slippageBps: params.slippageBps ?? 50,
      restrictIntermediateTokens: params.restrictIntermediateTokens ?? true,
      onlyDirectRoutes: params.onlyDirectRoutes ?? false,
      asLegacyTransaction: params.asLegacyTransaction ?? false,
      maxAccounts: params.maxAccounts ?? 64,
      platformFeeBps: params.platformFeeBps,
      feeAccount: params.feeAccount,
      // Parâmetros opcionais úteis
      swapMode: params.swapMode, // ExactIn ou ExactOut
      dexes: params.dexes?.join(','), // Lista de DEXes para incluir
      excludeDexes: params.excludeDexes?.join(','), // Lista de DEXes para excluir
      instructionVersion: params.instructionVersion, // 0 = legacy, 1 = versioned
    };

    return this.apiRequest<JupiterQuoteResponse>('GET', '/swap/v1/quote', { query }, requestId);
  }

  /**
   * Construir transação de swap
   * POST /swap/v1/swap
   */
  async buildSwapTransaction(params: JupiterSwapParams, requestId?: string): Promise<JupiterSwapResponse> {
    return this.apiRequest<JupiterSwapResponse>('POST', '/swap/v1/swap', { body: params }, requestId);
  }

  /**
   * Obter instruções de swap (sem transação serializada)
   * POST /swap/v1/swap-instructions
   */
  async buildSwapInstructions(params: JupiterSwapParams, requestId?: string): Promise<any> {
    return this.apiRequest<any>('POST', '/swap/v1/swap-instructions', { body: params }, requestId);
  }

  /**
   * Obter preços de tokens (Price API V3)
   * GET /price/v3?ids=mint1,mint2,...
   * Máximo 50 tokens por requisição
   */
  async getPrices(mintAddresses: string[], requestId?: string): Promise<JupiterPriceResponse> {
    if (mintAddresses.length === 0) return {};
    if (mintAddresses.length > 50) {
      const error = new Error('Máximo 50 tokens por requisição');
      trackJupiterApiError(error, {} as any, {
        requestId,
        endpoint: '/price/v3',
        metadata: { count: mintAddresses.length },
      });
      throw error;
    }

    const ids = mintAddresses.join(',');
    return this.apiRequest<JupiterPriceResponse>('GET', '/price/v3', { query: { ids } }, requestId);
  }
}

// Instância singleton
export const jupiterClient = new JupiterClient();

/**
 * Helper para verificar se Jupiter está disponível
 */
export function isJupiterAvailable(): boolean {
  return jupiterClient.isConfigured();
}
