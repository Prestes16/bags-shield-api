/**
 * Swap Router (contrato único)
 * Roteia requests para providers isolados (jupiter, future providers)
 */

import { JupiterProvider } from '@/providers/jupiter';
import type {
  SwapProviderQuoteParams,
  SwapProviderQuoteResult,
  SwapProviderBuildParams,
  SwapProviderBuildResult,
} from '@/providers/jupiter';

export interface RouterQuoteResult {
  success: true;
  response: SwapProviderQuoteResult;
  meta: { requestId: string; provider: string; latency: number };
}

export interface RouterQuoteError {
  success: false;
  error: 'NO_ROUTE' | 'PROVIDER_ERROR' | 'INVALID_PARAMS';
  details: {
    providerTried: string[];
    reason: string;
    nextActions: string[];
  };
  meta: { requestId: string };
}

export interface RouterBuildResult {
  success: true;
  response: SwapProviderBuildResult;
  meta: { requestId: string; provider: string; latency: number };
}

export interface RouterBuildError {
  success: false;
  error: 'BUILD_FAILED' | 'INVALID_PARAMS';
  details?: {
    providerTried: string[];
    reason: string;
  };
  meta: { requestId: string };
}

function isJupiterEnabled(): boolean {
  const flag = process.env.SWAP_PROVIDER_JUPITER?.toLowerCase();
  return flag === 'on' || flag === 'true' || flag === '1';
}

function shouldUseFallbacks(): boolean {
  const flag = process.env.SWAP_FALLBACKS?.toLowerCase();
  return flag === 'on' || flag === 'true' || flag === '1';
}

export class SwapRouter {
  private jupiter: JupiterProvider;

  constructor() {
    this.jupiter = new JupiterProvider();
  }

  async getQuote(params: SwapProviderQuoteParams, requestId: string): Promise<RouterQuoteResult | RouterQuoteError> {
    const startTime = Date.now();
    const providersTried: string[] = [];

    // Validação básica
    if (!params.inputMint || !params.outputMint || !params.amount) {
      return {
        success: false,
        error: 'INVALID_PARAMS',
        details: {
          providerTried: [],
          reason: 'Missing required params: inputMint, outputMint, amount',
          nextActions: ['check_params'],
        },
        meta: { requestId },
      };
    }

    // Jupiter (v0: único provider)
    if (isJupiterEnabled()) {
      try {
        providersTried.push('jupiter');
        const result = await this.jupiter.getQuote(params);
        const latency = Date.now() - startTime;

        return {
          success: true,
          response: result,
          meta: { requestId, provider: 'jupiter', latency },
        };
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        const isNoRoute = errorMsg.includes('NO_ROUTE') || errorMsg.includes('no route') || errorMsg.includes('404');

        if (isNoRoute) {
          return {
            success: false,
            error: 'NO_ROUTE',
            details: {
              providerTried: providersTried,
              reason: 'No route found for this pair at current liquidity',
              nextActions: ['try_again_later', 'check_mint', 'view_explorer'],
            },
            meta: { requestId },
          };
        }

        // Outro erro: se fallbacks estão desligados, retorna erro
        if (!shouldUseFallbacks()) {
          return {
            success: false,
            error: 'PROVIDER_ERROR',
            details: {
              providerTried: providersTried,
              reason: errorMsg,
              nextActions: ['try_again_later', 'check_provider_status'],
            },
            meta: { requestId },
          };
        }

        // Fallbacks desabilitados em v0
        // Future: tentar outro provider aqui
      }
    }

    // Nenhum provider disponível
    return {
      success: false,
      error: 'NO_ROUTE',
      details: {
        providerTried: providersTried,
        reason: 'No swap providers enabled',
        nextActions: ['check_config', 'enable_provider'],
      },
      meta: { requestId },
    };
  }

  async buildSwap(params: SwapProviderBuildParams, requestId: string): Promise<RouterBuildResult | RouterBuildError> {
    const startTime = Date.now();

    // Validação básica
    if (!params.quoteResponse || !params.userPublicKey) {
      return {
        success: false,
        error: 'INVALID_PARAMS',
        details: {
          providerTried: [],
          reason: 'Missing required params: quoteResponse, userPublicKey',
        },
        meta: { requestId },
      };
    }

    // Determinar provider do quoteResponse (v0: sempre jupiter)
    // O quoteResponse vem do resultado do quote (já tem provider: "jupiter")
    const provider = params.quoteResponse?.provider || 'jupiter';

    try {
      let result: SwapProviderBuildResult;

      if (provider === 'jupiter' && isJupiterEnabled()) {
        result = await this.jupiter.buildSwap(params);
      } else {
        throw new Error(`Provider ${provider} not enabled or not found`);
      }

      const latency = Date.now() - startTime;

      return {
        success: true,
        response: result,
        meta: { requestId, provider, latency },
      };
    } catch (err: any) {
      return {
        success: false,
        error: 'BUILD_FAILED',
        details: {
          providerTried: [provider],
          reason: err?.message || 'Failed to build swap transaction',
        },
        meta: { requestId },
      };
    }
  }
}

// Singleton
export const swapRouter = new SwapRouter();
