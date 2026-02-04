/**
 * useJupiterSwap Hook
 *
 * React hook for Jupiter swap operations with Bags Shield security integration
 *
 * Security: Fail-closed design - swaps are blocked if isSafe=false
 * Mobile: Optimized with dynamic compute units and auto prioritization fees
 */

import { useState, useCallback } from 'react';
import { VersionedTransaction } from '@solana/web3.js';
import {
  getQuote,
  buildSwapTransaction,
  sendTransaction,
  confirmTransaction,
  type JupiterQuoteParams,
  type JupiterQuoteResponse,
  type JupiterSwapParams,
} from '../services/jupiter';
import { buildSwapTransactionOnly as buildSwapTransactionOnlyImpl } from './useJupiterSwap-standalone';

// Re-exportação única: componente v0 e página podem importar daqui
export { buildSwapTransactionOnly } from './useJupiterSwap-standalone';

/**
 * Tipo de retorno para signTransaction callback
 *
 * Componentes v0 esperam receber VersionedTransaction diretamente
 * para usar com wallet.sendTransaction()
 */
export type SignTransactionCallback = (transaction: VersionedTransaction) => Promise<VersionedTransaction>;

// ============================================================================
// Types
// ============================================================================

export interface UseJupiterSwapOptions {
  isSafe?: boolean; // Bags Shield security flag - REQUIRED for fail-closed security
  onSuccess?: (signature: string) => void;
  onError?: (error: Error) => void;
}

export interface UseJupiterSwapReturn {
  // Quote state
  quote: JupiterQuoteResponse | null;
  isLoadingQuote: boolean;
  quoteError: string | null;

  // Swap state
  isSwapping: boolean;
  swapError: string | null;
  swapSignature: string | null;
  swapTransaction: VersionedTransaction | null; // Transação deserializada (pronta para wallet.sendTransaction)

  // Actions
  fetchQuote: (params: JupiterQuoteParams) => Promise<void>;
  executeSwap: (
    quoteResponse: JupiterQuoteResponse,
    userPublicKey: string,
    signTransaction: SignTransactionCallback,
  ) => Promise<void>;
  buildSwapTransactionOnly: (
    quoteResponse: JupiterQuoteResponse,
    userPublicKey: string,
  ) => Promise<VersionedTransaction>; // Novo: apenas constrói transação, não envia
  reset: () => void;
}

// ============================================================================
// Error Messages (User-friendly)
// ============================================================================

const ERROR_MESSAGES: Record<string, string> = {
  SWAP_BLOCKED: 'Swap bloqueado: Token marcado como Alto Risco pelo Bags Shield.',
  SLIPPAGE_TOO_LOW: 'Slippage muito baixo. Aumente a tolerância de slippage e tente novamente.',
  INSUFFICIENT_BALANCE: 'Saldo insuficiente. Verifique seu saldo e tente novamente.',
  NETWORK_ERROR: 'Erro de rede. Verifique sua conexão e tente novamente.',
  QUOTE_EXPIRED: 'Cotação expirada. Obtenha uma nova cotação e tente novamente.',
  TRANSACTION_FAILED: 'Transação falhou. Tente novamente ou verifique os parâmetros.',
  UNKNOWN_ERROR: 'Erro desconhecido. Tente novamente mais tarde.',
};

function getUserFriendlyError(error: Error | string): string {
  const errorMessage = typeof error === 'string' ? error : error.message;

  // Check for specific error patterns
  if (errorMessage.includes('slippage') || errorMessage.includes('Slippage')) {
    return ERROR_MESSAGES.SLIPPAGE_TOO_LOW;
  }

  if (errorMessage.includes('balance') || errorMessage.includes('insufficient')) {
    return ERROR_MESSAGES.INSUFFICIENT_BALANCE;
  }

  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }

  if (errorMessage.includes('expired') || errorMessage.includes('expire')) {
    return ERROR_MESSAGES.QUOTE_EXPIRED;
  }

  if (errorMessage.includes('Blocked') || errorMessage.includes('blocked')) {
    return ERROR_MESSAGES.SWAP_BLOCKED;
  }

  // Return original message if no match, or fallback
  return errorMessage || ERROR_MESSAGES.UNKNOWN_ERROR;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useJupiterSwap(options: UseJupiterSwapOptions = {}): UseJupiterSwapReturn {
  const { isSafe, onSuccess, onError } = options;

  // Quote state
  const [quote, setQuote] = useState<JupiterQuoteResponse | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Swap state
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapSignature, setSwapSignature] = useState<string | null>(null);
  const [swapTransaction, setSwapTransaction] = useState<VersionedTransaction | null>(null);

  /**
   * Fetch quote from Jupiter
   */
  const fetchQuote = useCallback(
    async (params: JupiterQuoteParams): Promise<void> => {
      setIsLoadingQuote(true);
      setQuoteError(null);
      setQuote(null);

      try {
        const quoteResponse = await getQuote(params);
        setQuote(quoteResponse);
      } catch (error) {
        const errorMessage = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
        setQuoteError(errorMessage);
        onError?.(error instanceof Error ? error : new Error(errorMessage));
      } finally {
        setIsLoadingQuote(false);
      }
    },
    [onError],
  );

  /**
   * Build swap transaction only (without sending) — delega ao standalone e atualiza estado do hook
   */
  const buildSwapTransactionOnly = useCallback(
    async (quoteResponse: JupiterQuoteResponse, userPublicKey: string): Promise<VersionedTransaction> => {
      if (isSafe === false || isSafe === undefined) {
        const securityError = new Error(ERROR_MESSAGES.SWAP_BLOCKED);
        setSwapError(ERROR_MESSAGES.SWAP_BLOCKED);
        onError?.(securityError);
        throw securityError;
      }
      setIsSwapping(true);
      setSwapError(null);
      setSwapTransaction(null);
      try {
        const transaction = await buildSwapTransactionOnlyImpl(quoteResponse, userPublicKey, isSafe);
        setSwapTransaction(transaction);
        return transaction;
      } catch (error) {
        const errorMessage = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
        setSwapError(errorMessage);
        onError?.(error instanceof Error ? error : new Error(errorMessage));
        throw error;
      } finally {
        setIsSwapping(false);
      }
    },
    [isSafe, onError],
  );

  /**
   * Execute swap with Bags Shield security check
   *
   * FAIL-CLOSED SECURITY:
   * If isSafe is false (or undefined), swap is blocked immediately
   * before even requesting wallet signature
   *
   * ATUALIZADO: Agora aceita SignTransactionCallback que recebe VersionedTransaction
   * diretamente (compatível com componentes v0 e wallet.sendTransaction)
   */
  const executeSwap = useCallback(
    async (
      quoteResponse: JupiterQuoteResponse,
      userPublicKey: string,
      signTransaction: SignTransactionCallback,
    ): Promise<void> => {
      // ========================================================================
      // SECURITY CHECK: Fail-closed design
      // ========================================================================
      if (isSafe === false || isSafe === undefined) {
        const securityError = new Error(ERROR_MESSAGES.SWAP_BLOCKED);
        setSwapError(ERROR_MESSAGES.SWAP_BLOCKED);
        onError?.(securityError);
        throw securityError;
      }

      setIsSwapping(true);
      setSwapError(null);
      setSwapSignature(null);
      setSwapTransaction(null);

      try {
        // 1. Build swap transaction (mobile-optimized)
        const swapParams: JupiterSwapParams = {
          quoteResponse,
          userPublicKey,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
        };

        // 2. Construir transação e deserializar para VersionedTransaction
        // Componentes v0 esperam receber VersionedTransaction diretamente
        const swapResponse = await buildSwapTransaction(swapParams);
        const transactionBuffer = Buffer.from(swapResponse.swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(transactionBuffer);

        setSwapTransaction(transaction);

        // Guardar lastValidBlockHeight para confirmação
        const lastValidBlockHeight = swapResponse.lastValidBlockHeight;

        // 3. Sign transaction (wallet interaction)
        // signTransaction agora recebe VersionedTransaction e retorna VersionedTransaction assinada
        // Compatível com wallet.sendTransaction() usado por componentes v0
        const signedTransaction = await signTransaction(transaction);

        // 4. Serializar transação assinada para base64 para envio
        const signedTransactionBase64 = Buffer.from(signedTransaction.serialize()).toString('base64');

        // 5. Send transaction via Helius RPC (reliable, avoids drops)
        const signature = await sendTransaction(signedTransactionBase64, false);

        // 6. Wait for confirmation using lastValidBlockHeight from swap response
        await confirmTransaction(signature, swapResponse.lastValidBlockHeight, 'confirmed');

        setSwapSignature(signature);
        onSuccess?.(signature);
      } catch (error) {
        const errorMessage = getUserFriendlyError(error instanceof Error ? error : new Error(String(error)));
        setSwapError(errorMessage);
        onError?.(error instanceof Error ? error : new Error(errorMessage));
        throw error;
      } finally {
        setIsSwapping(false);
      }
    },
    [isSafe, onSuccess, onError],
  );

  /**
   * Reset all state
   */
  const reset = useCallback((): void => {
    setQuote(null);
    setQuoteError(null);
    setIsLoadingQuote(false);
    setIsSwapping(false);
    setSwapError(null);
    setSwapSignature(null);
    setSwapTransaction(null);
  }, []);

  return {
    // Quote state
    quote,
    isLoadingQuote,
    quoteError,

    // Swap state
    isSwapping,
    swapError,
    swapSignature,
    swapTransaction, // Transação deserializada (pronta para assinar com wallet.sendTransaction)

    // Actions
    fetchQuote,
    executeSwap,
    buildSwapTransactionOnly, // Novo: apenas constrói transação, não envia
    reset,
  };
}
