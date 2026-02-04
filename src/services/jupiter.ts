/**
 * Jupiter Swap Service - Client-side implementation
 *
 * ⚠️ IMPORTANTE: Usando Jupiter API V1 (não V6)
 * - V6 (quote-api.jup.ag/v6) está DEPRECATED
 * - Endpoint atual: https://api.jup.ag/swap/v1/
 * - Header x-api-key é OBRIGATÓRIO
 *
 * Mobile-first optimization with Helius RPC for reliable transaction broadcasting
 */

import { Connection, VersionedTransaction } from '@solana/web3.js';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface JupiterQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string | number;
  slippageBps?: number;
  swapMode?: 'ExactIn' | 'ExactOut';
  dexes?: string[];
  excludeDexes?: string[];
  asLegacyTransaction?: boolean;
  maxAccounts?: number;
  platformFeeBps?: number;
  feeAccount?: string;
}

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: 'ExactIn' | 'ExactOut';
  slippageBps: number;
  platformFee: unknown;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
}

export interface JupiterSwapParams {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  useSharedAccounts?: boolean;
  feeAccount?: string;
  trackingAccount?: string;
  dynamicComputeUnitLimit?: boolean;
  prioritizationFeeLamports?:
    | 'auto'
    | number
    | {
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
  prioritizationType?: unknown;
  dynamicSlippageReport?: unknown;
  simulationError?: unknown;
}

export interface JupiterError {
  code: string;
  message: string;
  details?: unknown;
}

// ============================================================================
// Connection & RPC Setup
// ============================================================================

/**
 * Get Solana Connection instance
 * Uses Helius RPC if available, falls back to public RPC with warning
 */
function getSolanaConnection(): Connection {
  const heliusRpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
  const publicRpcUrl = 'https://api.mainnet-beta.solana.com';

  if (heliusRpcUrl) {
    return new Connection(heliusRpcUrl, 'confirmed');
  }

  // Log warning if using public RPC (may cause transaction drops)
  if (typeof window !== 'undefined' && typeof console !== 'undefined') {
    console.warn(
      '⚠️ [Jupiter Service] Using public Solana RPC. ' +
        'Set NEXT_PUBLIC_HELIUS_RPC_URL for better reliability and to avoid transaction drops. ' +
        'Or use /api/rpc-proxy for maximum security (recommended).',
    );
  }

  // Security warning if heliusRpcUrl contains api-key (insecure)
  if (heliusRpcUrl && heliusRpcUrl.includes('api-key=') && typeof window !== 'undefined') {
    console.error(
      '🚨 SECURITY WARNING: HELIUS_API_KEY está sendo exposta no cliente! ' +
        'Use /api/rpc-proxy ao invés de Connection direta para máxima segurança.',
    );
  }

  return new Connection(publicRpcUrl, 'confirmed');
}

// Singleton connection instance
let connectionInstance: Connection | null = null;

export function getConnection(): Connection {
  if (!connectionInstance) {
    connectionInstance = getSolanaConnection();
  }
  return connectionInstance;
}

// ============================================================================
// Jupiter API Client
// ============================================================================

const JUPITER_API_BASE = process.env.NEXT_PUBLIC_JUPITER_API_BASE || 'https://api.jup.ag';
const JUPITER_API_KEY = process.env.NEXT_PUBLIC_JUPITER_API_KEY || '';

/**
 * Make request to Jupiter API with x-api-key header
 */
async function jupiterRequest<T>(method: 'GET' | 'POST', endpoint: string, body?: unknown): Promise<T> {
  const url = `${JUPITER_API_BASE}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // x-api-key is REQUIRED for all endpoints
  if (JUPITER_API_KEY) {
    headers['x-api-key'] = JUPITER_API_KEY;
  } else {
    throw new Error('JUPITER_API_KEY não configurada. Configure NEXT_PUBLIC_JUPITER_API_KEY em .env.local');
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (method === 'POST' && body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    let errorData: JupiterError;

    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = {
        code: 'HTTP_ERROR',
        message: `Jupiter API error: ${response.status} - ${errorText}`,
      };
    }

    throw new Error(errorData.message || `Jupiter API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get swap quote from Jupiter
 */
export async function getQuote(params: JupiterQuoteParams): Promise<JupiterQuoteResponse> {
  const queryParams = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: String(params.amount),
    slippageBps: String(params.slippageBps ?? 50),
  });

  // Optional parameters
  if (params.swapMode) {
    queryParams.set('swapMode', params.swapMode);
  }
  if (params.dexes && params.dexes.length > 0) {
    queryParams.set('dexes', params.dexes.join(','));
  }
  if (params.excludeDexes && params.excludeDexes.length > 0) {
    queryParams.set('excludeDexes', params.excludeDexes.join(','));
  }
  if (params.asLegacyTransaction !== undefined) {
    queryParams.set('asLegacyTransaction', String(params.asLegacyTransaction));
  }
  if (params.maxAccounts !== undefined) {
    queryParams.set('maxAccounts', String(params.maxAccounts));
  }
  if (params.platformFeeBps !== undefined) {
    queryParams.set('platformFeeBps', String(params.platformFeeBps));
  }
  if (params.feeAccount) {
    queryParams.set('feeAccount', params.feeAccount);
  }

  return jupiterRequest<JupiterQuoteResponse>('GET', `/swap/v1/quote?${queryParams.toString()}`);
}

/**
 * Build swap transaction (mobile-optimized)
 *
 * Mobile optimization enforced:
 * - dynamicComputeUnitLimit: true (required for mobile UX)
 * - prioritizationFeeLamports: 'auto' (required for mobile UX)
 */
export async function buildSwapTransaction(params: JupiterSwapParams): Promise<JupiterSwapResponse> {
  // Mobile optimization: force required settings
  const swapParams: JupiterSwapParams = {
    ...params,
    dynamicComputeUnitLimit: true, // REQUIRED for mobile
    prioritizationFeeLamports: 'auto', // REQUIRED for mobile
    wrapAndUnwrapSol: params.wrapAndUnwrapSol ?? true,
  };

  return jupiterRequest<JupiterSwapResponse>('POST', '/swap/v1/swap', swapParams);
}

/**
 * Build swap transaction and return as VersionedTransaction (deserialized)
 *
 * Útil para componentes v0 que precisam da transação deserializada
 * para passar diretamente para wallet.sendTransaction()
 *
 * @param params Jupiter swap parameters
 * @returns VersionedTransaction pronta para assinar
 */
export async function buildSwapTransactionAsVersioned(params: JupiterSwapParams): Promise<VersionedTransaction> {
  const swapResponse = await buildSwapTransaction(params);

  // Deserializar transação base64 para VersionedTransaction
  // Componentes v0 esperam receber VersionedTransaction diretamente
  const transactionBuffer = Buffer.from(swapResponse.swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(transactionBuffer);

  return transaction;
}

/**
 * Send transaction using Helius RPC connection
 * This avoids transaction drops common with public RPCs
 */
export async function sendTransaction(transactionBase64: string, skipPreflight = false): Promise<string> {
  const connection = getConnection();

  // Deserialize transaction
  const transactionBuffer = Buffer.from(transactionBase64, 'base64');
  const transaction = VersionedTransaction.deserialize(transactionBuffer);

  // Send via Helius RPC (more reliable, avoids drops)
  const signature = await connection.sendTransaction(transaction, {
    skipPreflight,
    maxRetries: 3,
  });

  return signature;
}

/**
 * Confirm transaction (wait for confirmation)
 *
 * @param signature Transaction signature
 * @param lastValidBlockHeight Last valid block height from swap response
 * @param commitment Commitment level
 */
export async function confirmTransaction(
  signature: string,
  lastValidBlockHeight: number,
  commitment: 'confirmed' | 'finalized' = 'confirmed',
): Promise<void> {
  const connection = getConnection();

  // Poll for confirmation
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash: '', // Not needed for signature-only confirmation
      lastValidBlockHeight,
    },
    commitment,
  );

  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }
}
