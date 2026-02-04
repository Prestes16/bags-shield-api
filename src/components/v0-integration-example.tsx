/**
 * Exemplo: Como passar buildSwapTransactionOnly para componentes v0
 * 
 * Este é um exemplo de como conectar tudo no componente pai
 */

'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { buildSwapTransactionOnly } from '@/hooks/useJupiterSwap-standalone';
import { useBagsShieldScan } from '@/hooks/useBagsShieldScan'; // Seu hook de segurança
import type { JupiterQuoteResponse } from '@/services/jupiter';

// Componente v0 (exemplo - você vai receber isso do v0)
interface TokenDashboardProps {
  wallet: ReturnType<typeof useWallet>;
  connection: ReturnType<typeof useConnection>['connection'];
  buildSwapTransactionOnly: (
    quoteResponse: JupiterQuoteResponse,
    userPublicKey: string
  ) => Promise<import('@solana/web3.js').VersionedTransaction>;
  // ... outras props do v0
}

function TokenDashboard(props: TokenDashboardProps) {
  // Componente v0 vai usar buildSwapTransactionOnly assim:
  const handleSwap = async () => {
    const quote = await getQuote(...); // Obter cotação
    
    // buildSwapTransactionOnly retorna VersionedTransaction diretamente
    const transaction = await props.buildSwapTransactionOnly(
      quote,
      props.wallet.publicKey!.toBase58()
    );
    
    // v0 usa wallet.sendTransaction diretamente
    const signature = await props.wallet.sendTransaction(
      transaction,
      props.connection
    );
    
    // Confirmar
    await props.connection.confirmTransaction(signature, 'confirmed');
  };
  
  return <div>...</div>;
}

// ============================================================================
// Componente Pai - A "Ponte" Final
// ============================================================================

export default function SwapPage() {
  const wallet = useWallet(); // ✅ A carteira real
  const { connection } = useConnection(); // ✅ A conexão Helius
  const outputMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const { isSafe } = useBagsShieldScan(outputMint); // ✅ Bags Shield security

  // Criar wrapper que passa isSafe do Bags Shield
  const buildSwapWrapper = async (
    quoteResponse: JupiterQuoteResponse,
    userPublicKey: string
  ) => {
    // ✅ Passa isSafe do Bags Shield para fail-closed security
    return buildSwapTransactionOnly(quoteResponse, userPublicKey, isSafe);
  };

  return (
    <TokenDashboard
      wallet={wallet}                    // ✅ Passando a carteira real
      connection={connection}            // ✅ Passando a conexão Helius
      buildSwapTransactionOnly={buildSwapWrapper} // ✅ Passando a função
      // O componente v0 recebe tudo que precisa!
    />
  );
}
