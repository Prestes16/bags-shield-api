/**
 * Jupiter Swap Provider (isolado)
 * Implementação isolada do provider Jupiter para swap-router
 */

import { getQuote, postSwap, type QuoteRequest, type SwapRequest } from '@/lib/jup';
import { getFeeDecision } from '@/lib/economy';

export interface SwapProviderQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
  swapMode?: 'ExactIn' | 'ExactOut';
  userOptOut?: boolean;
  tier?: 'free' | 'pro';
  wantsPremium?: boolean;
}

export interface SwapProviderQuoteResult {
  provider: 'jupiter';
  quote: any; // JupiterQuoteResponse
  fee: {
    feeBps: number;
    feeAccount?: string;
    trackingAccount: string;
  };
}

export interface SwapProviderBuildParams {
  quoteResponse: any;
  userPublicKey: string;
  feeAccount?: string;
  trackingAccount?: string;
}

export interface SwapProviderBuildResult {
  provider: 'jupiter';
  swapTransaction: string; // base64
  lastValidBlockHeight?: number;
}

export class JupiterProvider {
  async getQuote(params: SwapProviderQuoteParams): Promise<SwapProviderQuoteResult> {
    const startTime = Date.now();

    // Decisão de fee
    const feeDecision = getFeeDecision({
      userOptOut: params.userOptOut ?? false,
      tier: params.tier ?? 'free',
      wantsPremium: params.wantsPremium ?? false,
      outputMint: params.outputMint, // ExactIn: fee no outputMint
    });

    // Request para Jupiter
    const quoteRequest: QuoteRequest = {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      slippageBps: params.slippageBps ?? 50,
      swapMode: params.swapMode ?? 'ExactIn',
      platformFeeBps: feeDecision.feeBps,
    };

    const quote = await getQuote(quoteRequest);
    const latency = Date.now() - startTime;

    // Log padronizado
    console.log(
      JSON.stringify({
        provider: 'jupiter',
        action: 'quote',
        status: 'success',
        latency,
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        feeBps: feeDecision.feeBps,
      }),
    );

    // Adiciona provider ao quote para o build saber qual provider usar
    const quoteWithProvider = { ...quote, provider: 'jupiter' };

    return {
      provider: 'jupiter',
      quote: quoteWithProvider,
      fee: {
        feeBps: feeDecision.feeBps,
        feeAccount: feeDecision.feeAccount,
        trackingAccount: feeDecision.trackingAccount,
      },
    };
  }

  async buildSwap(params: SwapProviderBuildParams): Promise<SwapProviderBuildResult> {
    const startTime = Date.now();

    const swapRequest: SwapRequest = {
      quoteResponse: params.quoteResponse,
      userPublicKey: params.userPublicKey,
      wrapAndUnwrapSol: true,
      feeAccount: params.feeAccount,
      trackingAccount: params.trackingAccount,
    };

    const swap = await postSwap(swapRequest);
    const latency = Date.now() - startTime;

    // Log padronizado
    console.log(
      JSON.stringify({
        provider: 'jupiter',
        action: 'build',
        status: 'success',
        latency,
        userPublicKey: params.userPublicKey.substring(0, 8) + '...',
        hasFeeAccount: !!params.feeAccount,
      }),
    );

    return {
      provider: 'jupiter',
      swapTransaction: swap.swapTransaction,
      lastValidBlockHeight: swap.lastValidBlockHeight,
    };
  }
}
