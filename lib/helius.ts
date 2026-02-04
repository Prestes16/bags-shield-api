/**
 * Integração com Helius API
 * - Enhanced Transactions API: https://api-mainnet.helius-rpc.com/v0/transactions e /v0/addresses/{address}/transactions
 * - RPC: https://mainnet.helius-rpc.com/?api-key=...
 */

import { trackHeliusApiError } from './error-tracking';

/** Base da API Enhanced (transações analisadas e histórico por endereço) */
const HELIUS_API_BASE = process.env.HELIUS_API_BASE || 'https://api-mainnet.helius-rpc.com';
/** URL do RPC Solana (getBalance, getSlot, getTransaction, etc.) */
const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || 'https://mainnet.helius-rpc.com';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';

export interface HeliusRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any[];
}

export interface HeliusRpcResponse<T = any> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface HeliusTransactionInfo {
  transaction: {
    signatures: string[];
    message: {
      accountKeys: string[];
      instructions: any[];
      recentBlockhash: string;
    };
  };
  meta?: {
    err?: any;
    fee: number;
    preBalances: number[];
    postBalances: number[];
    innerInstructions?: any[];
    logMessages?: string[];
  };
}

export interface HeliusSimulateTransactionParams {
  transaction: string; // Base64 encoded transaction
  replaceRecentBlockhash?: boolean;
  commitment?: 'finalized' | 'confirmed' | 'processed';
  sigVerify?: boolean;
  accounts?: {
    encoding?: 'base64' | 'jsonParsed';
    addresses?: string[];
  };
}

/** Opções para histórico de transações por endereço */
export interface HeliusAddressTransactionsOptions {
  before?: string;
  after?: string;
  commitment?: 'finalized' | 'confirmed';
  limit?: number; // 1-100
  sortOrder?: 'asc' | 'desc';
  type?: string;
  source?: string;
  gtSlot?: number;
  gteSlot?: number;
  ltSlot?: number;
  lteSlot?: number;
  gtTime?: number;
  gteTime?: number;
  ltTime?: number;
  lteTime?: number;
}

class HeliusClient {
  private apiKey: string;
  private apiBase: string;
  private rpcUrl: string;
  private timeout: number;

  constructor() {
    this.apiKey = HELIUS_API_KEY;
    this.apiBase = HELIUS_API_BASE;
    this.rpcUrl = HELIUS_RPC_URL;
    this.timeout = Number(process.env.HELIUS_TIMEOUT_MS || 15_000);
  }

  /**
   * Verifica se a API está configurada
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Faz uma requisição RPC para a Helius
   */
  private async rpcRequest<T = any>(
    method: string,
    params: any[] = [],
    requestId?: string,
  ): Promise<HeliusRpcResponse<T>> {
    if (!this.isConfigured()) {
      const error = new Error('HELIUS_API_KEY não configurada');
      trackHeliusApiError(error, {} as any, {
        requestId,
        endpoint: method,
        metadata: { method, params: params.length },
      });
      throw error;
    }

    const rpcRequest: HeliusRpcRequest = {
      jsonrpc: '2.0',
      id: requestId || Date.now(),
      method,
      params,
    };

    const url = `${this.rpcUrl}/?api-key=${this.apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rpcRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Helius API error: ${response.status} - ${errorText}`);
        trackHeliusApiError(error, {} as any, {
          requestId,
          endpoint: method,
          metadata: {
            status: response.status,
            statusText: response.statusText,
            method,
          },
        });
        throw error;
      }

      const data: HeliusRpcResponse<T> = await response.json();

      if (data.error) {
        const error = new Error(`Helius RPC error: ${data.error.message}`);
        trackHeliusApiError(error, {} as any, {
          requestId,
          endpoint: method,
          metadata: {
            rpcError: data.error,
            method,
          },
        });
        throw error;
      }

      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        const timeoutError = new Error(`Helius API timeout após ${this.timeout}ms`);
        trackHeliusApiError(timeoutError, {} as any, {
          requestId,
          endpoint: method,
          severity: 'high',
          metadata: { timeout: this.timeout, method },
        });
        throw timeoutError;
      }

      // Re-throw se já foi tratado acima
      if (err.message?.includes('Helius')) {
        throw err;
      }

      // Erro de rede ou outro erro inesperado
      trackHeliusApiError(err, {} as any, {
        requestId,
        endpoint: method,
        severity: 'high',
        metadata: { method, errorType: err.name },
      });
      throw err;
    }
  }

  /**
   * Requisição HTTP para a Enhanced API (v0/transactions, v0/addresses/...)
   */
  private async enhancedApiRequest<T = any>(
    method: 'GET' | 'POST',
    path: string,
    options: { body?: any; query?: Record<string, string | number | undefined> } = {},
    requestId?: string,
  ): Promise<T> {
    if (!this.isConfigured()) {
      const error = new Error('HELIUS_API_KEY não configurada');
      trackHeliusApiError(error, {} as any, {
        requestId,
        endpoint: path,
        metadata: { method },
      });
      throw error;
    }

    const searchParams = new URLSearchParams({ 'api-key': this.apiKey });
    if (options.query) {
      Object.entries(options.query).forEach(([k, v]) => {
        if (v !== undefined && v !== '') searchParams.set(k, String(v));
      });
    }
    const url = `${this.apiBase}${path}?${searchParams.toString()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const init: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      };
      if (method === 'POST' && options.body) {
        init.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, init);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Helius Enhanced API error: ${response.status} - ${errorText}`);
        trackHeliusApiError(error, {} as any, {
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
        const timeoutError = new Error(`Helius Enhanced API timeout após ${this.timeout}ms`);
        trackHeliusApiError(timeoutError, {} as any, {
          requestId,
          endpoint: path,
          severity: 'high',
          metadata: { timeout: this.timeout, method },
        });
        throw timeoutError;
      }
      if (err.message?.includes('Helius')) throw err;
      trackHeliusApiError(err, {} as any, {
        requestId,
        endpoint: path,
        severity: 'high',
        metadata: { method },
      });
      throw err;
    }
  }

  /**
   * Analisar transação(ões) – Enhanced Transactions API
   * POST /v0/transactions – retorna transações em formato legível
   */
  async getEnhancedTransactions(
    signatures: string[],
    options: { commitment?: 'finalized' | 'confirmed' } = {},
    requestId?: string,
  ): Promise<any[]> {
    if (signatures.length === 0) return [];
    if (signatures.length > 100) {
      const error = new Error('Máximo 100 transações por requisição');
      trackHeliusApiError(error, {} as any, { requestId, endpoint: '/v0/transactions', metadata: { count: signatures.length } });
      throw error;
    }
    const query: Record<string, string> = {};
    if (options.commitment) query.commitment = options.commitment;
    const result = await this.enhancedApiRequest<any[]>(
      'POST',
      '/v0/transactions',
      { body: { transactions: signatures }, query: Object.keys(query).length ? query : undefined },
      requestId,
    );
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Histórico de transações de um endereço – Enhanced Transactions API
   * GET /v0/addresses/{address}/transactions
   */
  async getAddressTransactions(
    address: string,
    options: HeliusAddressTransactionsOptions = {},
    requestId?: string,
  ): Promise<any[]> {
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 100);
    const query: Record<string, string | number | undefined> = {
      limit,
      ...(options.before && { 'before': options.before }),
      ...(options.after && { 'after': options.after }),
      ...(options.commitment && { 'commitment': options.commitment }),
      ...(options.sortOrder && { 'sort-order': options.sortOrder }),
      ...(options.type && { 'type': options.type }),
      ...(options.source && { 'source': options.source }),
      ...(options.gtSlot != null && { 'gt-slot': options.gtSlot }),
      ...(options.gteSlot != null && { 'gte-slot': options.gteSlot }),
      ...(options.ltSlot != null && { 'lt-slot': options.ltSlot }),
      ...(options.lteSlot != null && { 'lte-slot': options.lteSlot }),
      ...(options.gtTime != null && { 'gt-time': options.gtTime }),
      ...(options.gteTime != null && { 'gte-time': options.gteTime }),
      ...(options.ltTime != null && { 'lt-time': options.ltTime }),
      ...(options.lteTime != null && { 'lte-time': options.lteTime }),
    };
    const result = await this.enhancedApiRequest<any[]>(
      'GET',
      `/v0/addresses/${encodeURIComponent(address)}/transactions`,
      { query },
      requestId,
    );
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Simula uma transação usando Helius
   */
  async simulateTransaction(
    transactionBase64: string,
    options: {
      replaceRecentBlockhash?: boolean;
      commitment?: 'finalized' | 'confirmed' | 'processed';
      sigVerify?: boolean;
    } = {},
    requestId?: string,
  ): Promise<HeliusRpcResponse<HeliusTransactionInfo>> {
    const params: HeliusSimulateTransactionParams = {
      transaction: transactionBase64,
      replaceRecentBlockhash: options.replaceRecentBlockhash ?? true,
      commitment: options.commitment || 'confirmed',
      sigVerify: options.sigVerify ?? false,
    };

    return this.rpcRequest<HeliusTransactionInfo>('simulateTransaction', [params], requestId);
  }

  /**
   * Obtém informações de uma transação
   */
  async getTransaction(
    signature: string,
    options: {
      commitment?: 'finalized' | 'confirmed' | 'processed';
      maxSupportedTransactionVersion?: number;
    } = {},
    requestId?: string,
  ): Promise<HeliusRpcResponse<any>> {
    const params: any[] = [
      signature,
      {
        commitment: options.commitment || 'confirmed',
        maxSupportedTransactionVersion: options.maxSupportedTransactionVersion || 0,
      },
    ];

    return this.rpcRequest('getTransaction', params, requestId);
  }

  /**
   * Obtém informações de múltiplas transações
   */
  async getTransactions(
    signatures: string[],
    options: {
      commitment?: 'finalized' | 'confirmed' | 'processed';
      maxSupportedTransactionVersion?: number;
    } = {},
    requestId?: string,
  ): Promise<HeliusRpcResponse<any[]>> {
    const params: any[] = [
      signatures,
      {
        commitment: options.commitment || 'confirmed',
        maxSupportedTransactionVersion: options.maxSupportedTransactionVersion || 0,
      },
    ];

    return this.rpcRequest<any[]>('getTransactions', params, requestId);
  }

  /**
   * Obtém informações de uma conta
   */
  async getAccountInfo(
    address: string,
    options: {
      encoding?: 'base64' | 'jsonParsed';
      commitment?: 'finalized' | 'confirmed' | 'processed';
    } = {},
    requestId?: string,
  ): Promise<HeliusRpcResponse<any>> {
    const params: any[] = [
      address,
      {
        encoding: options.encoding || 'jsonParsed',
        commitment: options.commitment || 'confirmed',
      },
    ];

    return this.rpcRequest('getAccountInfo', params, requestId);
  }

  /**
   * Obtém o saldo de uma conta
   */
  async getBalance(
    address: string,
    commitment: 'finalized' | 'confirmed' | 'processed' = 'confirmed',
    requestId?: string,
  ): Promise<HeliusRpcResponse<number>> {
    const params: any[] = [address, { commitment }];
    return this.rpcRequest<number>('getBalance', params, requestId);
  }

  /**
   * Obtém o slot atual
   */
  async getSlot(requestId?: string): Promise<HeliusRpcResponse<number>> {
    return this.rpcRequest<number>('getSlot', [], requestId);
  }

  /**
   * Obtém informações do bloco
   */
  async getBlock(
    slot: number,
    options: {
      encoding?: 'json' | 'jsonParsed';
      transactionDetails?: 'full' | 'signatures' | 'none';
      maxSupportedTransactionVersion?: number;
    } = {},
    requestId?: string,
  ): Promise<HeliusRpcResponse<any>> {
    const params: any[] = [
      slot,
      {
        encoding: options.encoding || 'json',
        transactionDetails: options.transactionDetails || 'full',
        maxSupportedTransactionVersion: options.maxSupportedTransactionVersion || 0,
      },
    ];

    return this.rpcRequest('getBlock', params, requestId);
  }
}

// Instância singleton
export const heliusClient = new HeliusClient();

/**
 * Helper para verificar se Helius está disponível
 */
export function isHeliusAvailable(): boolean {
  return heliusClient.isConfigured();
}
