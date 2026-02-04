/**
 * Standalone buildSwapTransactionOnly Function
 *
 * Esta função pode ser exportada e passada diretamente como prop para componentes v0
 *
 * Uso:
 * ```typescript
 * import { buildSwapTransactionOnly } from '@/hooks/useJupiterSwap-standalone';
 *
 * // No componente pai
 * <TokenDashboard
 *   buildSwapTransactionOnly={buildSwapTransactionOnly}
 *   // ... outras props
 * />
 * ```
 */

import { VersionedTransaction } from '@solana/web3.js';
import {
  buildSwapTransactionAsVersioned,
  type JupiterQuoteResponse,
  type JupiterSwapParams,
} from '../services/jupiter';

/**
 * Build swap transaction only - Standalone export
 *
 * ⚠️ CRÍTICO: Esta função retorna VersionedTransaction deserializada
 * pronta para wallet.sendTransaction() usado por componentes v0
 *
 * @param quoteResponse - Resposta da cotação Jupiter
 * @param userPublicKey - Chave pública do usuário (base58 string)
 * @param isSafe - Flag de segurança Bags Shield (opcional, padrão: true)
 * @returns VersionedTransaction pronta para assinar
 *
 * @example
 * ```typescript
 * const transaction = await buildSwapTransactionOnly(quote, publicKey, isSafe);
 * const signature = await wallet.sendTransaction(transaction, connection);
 * ```
 */
export async function buildSwapTransactionOnly(
  quoteResponse: JupiterQuoteResponse,
  userPublicKey: string,
  isSafe: boolean = true,
): Promise<VersionedTransaction> {
  // ========================================================================
  // SECURITY CHECK: Fail-closed design
  // ========================================================================
  if (!isSafe) {
    throw new Error('Swap bloqueado: Token marcado como Alto Risco pelo Bags Shield.');
  }

  // Build swap transaction (mobile-optimized)
  const swapParams: JupiterSwapParams = {
    quoteResponse,
    userPublicKey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true, // REQUIRED for mobile
    prioritizationFeeLamports: 'auto', // REQUIRED for mobile
  };

  // Retorna VersionedTransaction deserializada (O PULO DO GATO)
  // Componentes v0 esperam receber VersionedTransaction diretamente
  const transaction = await buildSwapTransactionAsVersioned(swapParams);

  return transaction;
}
