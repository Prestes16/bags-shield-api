/**
 * Exemplo de uso do hook useJupiterSwap
 * 
 * Este arquivo demonstra como integrar o hook com wallet adapters
 * e Bags Shield security
 */

import { useJupiterSwap } from './useJupiterSwap';
import { buildSwapTransactionOnly as buildSwapStandalone } from './useJupiterSwap-standalone';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';

// Exemplo: Hook de segurança Bags Shield (você precisa implementar)
function useBagsShieldScan(mintAddress: string): { isSafe: boolean; isLoading: boolean } {
  // Implementação do seu scan de segurança
  // Retorna isSafe baseado na análise do token
  return { isSafe: true, isLoading: false };
}

export function SwapComponentExample() {
  const { publicKey, signTransaction: walletSignTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const inputMint = 'So11111111111111111111111111111111111111112'; // SOL
  const outputMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
  
  // Obter status de segurança do Bags Shield
  const { isSafe, isLoading: isScanning } = useBagsShieldScan(outputMint);
  
  const {
    quote,
    isLoadingQuote,
    quoteError,
    isSwapping,
    swapError,
    swapSignature,
    swapTransaction, // Transação deserializada (pronta para assinar)
    fetchQuote,
    executeSwap,
    buildSwapTransactionOnly, // Novo: apenas constrói transação
    reset,
  } = useJupiterSwap({
    isSafe, // CRÍTICO: Fail-closed security
    onSuccess: (signature) => {
      console.log('✅ Swap realizado com sucesso:', signature);
      // Mostrar toast de sucesso, atualizar UI, etc.
    },
    onError: (error) => {
      console.error('❌ Erro no swap:', error);
      // Mostrar toast de erro, logar erro, etc.
    },
  });

  // Handler para obter cotação
  const handleGetQuote = async () => {
    await fetchQuote({
      inputMint,
      outputMint,
      amount: '100000000', // 0.1 SOL (100000000 lamports)
      slippageBps: 50, // 0.5%
      swapMode: 'ExactIn',
    });
  };

  // Handler para executar swap
  const handleSwap = async () => {
    if (!quote || !publicKey) {
      console.error('Cotação ou carteira não disponível');
      return;
    }

    try {
      await executeSwap(
        quote,
        publicKey.toBase58(),
        // Wrapper para compatibilidade com wallet adapter
        async (transactionBase64: string): Promise<string> => {
          // Deserializar transação
          const transactionBuffer = Buffer.from(transactionBase64, 'base64');
          const transaction = VersionedTransaction.deserialize(transactionBuffer);
          
          // Assinar com wallet adapter
          const signedTransaction = await walletSignTransaction(transaction);
          
          // Retornar como base64
          return Buffer.from(signedTransaction.serialize()).toString('base64');
        }
      );
    } catch (error) {
      // Erro já é tratado pelo hook (onError callback)
      console.error('Erro ao executar swap:', error);
    }
  };

  return (
    <div className="swap-container">
      <h2>Jupiter Swap</h2>
      
      {/* Status de segurança */}
      {isScanning ? (
        <p>Verificando segurança do token...</p>
      ) : !isSafe ? (
        <div className="security-warning">
          ⚠️ Token marcado como ALTO RISCO pelo Bags Shield. Swap bloqueado.
        </div>
      ) : (
        <div className="security-ok">✅ Token verificado e seguro</div>
      )}

      {/* Obter cotação */}
      <button
        onClick={handleGetQuote}
        disabled={isLoadingQuote || !isSafe}
      >
        {isLoadingQuote ? 'Obtendo cotação...' : 'Obter Cotação'}
      </button>

      {/* Erro na cotação */}
      {quoteError && (
        <div className="error">
          ❌ Erro ao obter cotação: {quoteError}
        </div>
      )}

      {/* Exibir cotação */}
      {quote && (
        <div className="quote-display">
          <h3>Cotação</h3>
          <p>Input: {quote.inAmount} (mint: {quote.inputMint.slice(0, 8)}...)</p>
          <p>Output: {quote.outAmount} (mint: {quote.outputMint.slice(0, 8)}...)</p>
          <p>Price Impact: {quote.priceImpactPct}%</p>
          <p>Slippage: {quote.slippageBps / 100}%</p>
          
          {/* Opção 1: Executar swap completo (envia automaticamente) */}
          <button
            onClick={handleSwap}
            disabled={isSwapping || !isSafe || !publicKey}
          >
            {isSwapping ? 'Processando swap...' : 'Executar Swap'}
          </button>
          
          {/* Opção 2: Apenas construir transação (para componentes v0) */}
          <button
            onClick={handleBuildTransaction}
            disabled={isSwapping || !isSafe || !publicKey}
          >
            Construir Transação (v0)
          </button>
          
          {/* Exibir transação construída (para debug) */}
          {swapTransaction && (
            <div className="transaction-info">
              <p>✅ Transação construída e pronta para assinar</p>
              <p>Signatures: {swapTransaction.signatures.length}</p>
            </div>
          )}
        </div>
      )}

      {/* Erro no swap */}
      {swapError && (
        <div className="error">
          ❌ Erro no swap: {swapError}
        </div>
      )}

      {/* Sucesso */}
      {swapSignature && (
        <div className="success">
          ✅ Swap realizado! Signature: {swapSignature.slice(0, 16)}...
        </div>
      )}

      {/* Reset */}
      <button onClick={reset} className="reset-button">
        Resetar
      </button>
    </div>
  );
}
