/**
 * RPC Client - Frontend Safe
 *
 * ⚠️ CRÍTICO: Este cliente NUNCA deve usar HELIUS_API_KEY diretamente.
 *
 * Todas as chamadas RPC passam pelo proxy /api/rpc-proxy que anexa
 * a chave no servidor (seguro).
 */

/**
 * Tipos RPC JSON-RPC 2.0
 */
export interface RpcRequest {
  method: string;
  params?: unknown[];
  id?: string | number;
}

export interface RpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Métodos RPC permitidos (whitelist)
 *
 * Apenas métodos seguros e necessários são permitidos
 */
export type AllowedRpcMethod =
  | 'getHealth'
  | 'getBalance'
  | 'getSlot'
  | 'getTransaction'
  | 'getAccountInfo'
  | 'simulateTransaction'
  | 'getBlock';

/**
 * Faz requisição RPC via proxy seguro
 *
 * A chave HELIUS_API_KEY nunca é exposta ao cliente.
 * O proxy /api/rpc-proxy anexa a chave no servidor.
 */
export async function rpcRequest<T = unknown>(
  method: AllowedRpcMethod,
  params: unknown[] = [],
  id?: string | number,
): Promise<T> {
  const response = await fetch('/api/rpc-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method,
      params,
      id: id || crypto.randomUUID(),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `RPC request failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'RPC request failed');
  }

  return data.response as T;
}

/**
 * Helpers para métodos RPC comuns
 */

export async function getBalance(address: string): Promise<number> {
  return rpcRequest<number>('getBalance', [address]);
}

export async function getSlot(): Promise<number> {
  return rpcRequest<number>('getSlot');
}

export async function getHealth(): Promise<'ok'> {
  return rpcRequest<'ok'>('getHealth');
}

export async function getTransaction(signature: string): Promise<unknown> {
  return rpcRequest('getTransaction', [signature]);
}

export async function getAccountInfo(address: string): Promise<unknown> {
  return rpcRequest('getAccountInfo', [address]);
}
