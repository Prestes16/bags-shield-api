/**
 * Helius API client utilities.
 * Aceita HELIUS_RPC_URL (URL completa com api-key) OU HELIUS_API_KEY (so a key).
 * Server-only, nunca NEXT_PUBLIC_.
 */

const MAX_DATA_URL_LENGTH = 200_000; // ~200KB para data URLs permitidas

const PLACEHOLDERS = ['COLE_SUA_CHAVE_AQUI', 'REDACTED'];

function getRpcUrlRaw(): string {
  return (process.env.HELIUS_RPC_URL ?? '').trim();
}

function getApiKeyRaw(): string {
  return (process.env.HELIUS_API_KEY ?? '').trim();
}

/** Extrai api-key da URL se existir (?api-key=xxx ou &api-key=xxx) */
function extractKeyFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const key = u.searchParams.get('api-key') ?? u.searchParams.get('api_key');
    return (key ?? '').trim();
  } catch {
    return '';
  }
}

function looksPlaceholder(val: string): boolean {
  if (!val) return true;
  if (PLACEHOLDERS.includes(val)) return true;
  if (val.toLowerCase().includes('cole_sua_chave')) return true;
  return false;
}

/**
 * HELIUS_RPC_URL valida: URL https com helius no host E api-key embutida plausivel.
 * URLs sem api-key (ou com key curta/placeholder) sao ignoradas - a Helius
 * responderia 401 e o scan retornaria "auth failed (upstream 401)".
 */
function isRpcUrlValid(url: string): boolean {
  if (!url || url.length < 30) return false;
  try {
    const u = new URL(url);
    const host = (u.hostname ?? '').toLowerCase();
    if (!((u.protocol === 'http:' || u.protocol === 'https:') && host.includes('helius'))) return false;
    const embeddedKey = extractKeyFromUrl(url);
    return embeddedKey.length >= 30 && !looksPlaceholder(embeddedKey);
  } catch {
    return false;
  }
}

/**
 * Helius esta configurado se:
 * - HELIUS_RPC_URL existe, tem host helius e api-key embutida plausivel
 * - OU HELIUS_API_KEY existe, len >= 30, nao e placeholder
 */
export function isHeliusConfigured(): boolean {
  const rpcUrl = getRpcUrlRaw();
  if (isRpcUrlValid(rpcUrl)) return true;

  const key = getApiKeyRaw();
  if (!key || key.length < 30) return false;
  if (looksPlaceholder(key)) return false;
  return true;
}

/** Obtem a API key: da URL ou de HELIUS_API_KEY */
export function getApiKey(): string {
  const rpcUrl = getRpcUrlRaw();
  const fromUrl = extractKeyFromUrl(rpcUrl);
  if (fromUrl && fromUrl.length >= 30 && !looksPlaceholder(fromUrl)) return fromUrl;
  const key = getApiKeyRaw();
  if (key && key.length >= 30 && !looksPlaceholder(key)) return key;
  return '';
}

/** @deprecated Use isHeliusConfigured. Mantido para compatibilidade. */
export function isValidKey(): boolean {
  return isHeliusConfigured();
}

/**
 * RPC URL (mainnet)
 * Prioridade: HELIUS_RPC_URL (somente se valida, com api-key embutida) >
 * montada a partir de HELIUS_API_KEY.
 */
export function getHeliusRpcUrl(): string {
  const rpcUrl = getRpcUrlRaw();
  if (isRpcUrlValid(rpcUrl)) return rpcUrl;
  const key = getApiKey();
  if (!key) return '';
  return `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`;
}

/**
 * Diagnostico sanitizado da configuracao Helius.
 * NUNCA retorna a key, query string completa ou URL completa.
 */
export interface HeliusDiagnostics {
  source: 'HELIUS_RPC_URL' | 'HELIUS_API_KEY' | 'none';
  rpcUrlEnv: { present: boolean; length: number; valid: boolean; host: string | null };
  apiKeyEnv: { present: boolean; length: number; placeholder: boolean };
  finalRpc: { host: string | null; hasApiKeyParam: boolean; length: number };
}

export function getHeliusDiagnostics(): HeliusDiagnostics {
  const rpcUrlRaw = getRpcUrlRaw();
  const apiKeyRaw = getApiKeyRaw();

  let rpcUrlHost: string | null = null;
  try {
    rpcUrlHost = rpcUrlRaw ? new URL(rpcUrlRaw).hostname : null;
  } catch {
    rpcUrlHost = null;
  }

  const rpcUrlValid = isRpcUrlValid(rpcUrlRaw);
  const finalUrl = getHeliusRpcUrl();

  let finalHost: string | null = null;
  let hasApiKeyParam = false;
  try {
    if (finalUrl) {
      const u = new URL(finalUrl);
      finalHost = u.hostname;
      hasApiKeyParam = u.searchParams.has('api-key') || u.searchParams.has('api_key');
    }
  } catch {
    finalHost = null;
  }

  const source: HeliusDiagnostics['source'] = rpcUrlValid
    ? 'HELIUS_RPC_URL'
    : finalUrl
      ? 'HELIUS_API_KEY'
      : 'none';

  return {
    source,
    rpcUrlEnv: {
      present: rpcUrlRaw.length > 0,
      length: rpcUrlRaw.length,
      valid: rpcUrlValid,
      host: rpcUrlHost,
    },
    apiKeyEnv: {
      present: apiKeyRaw.length > 0,
      length: apiKeyRaw.length,
      placeholder: apiKeyRaw.length > 0 && looksPlaceholder(apiKeyRaw),
    },
    finalRpc: {
      host: finalHost,
      hasApiKeyParam,
      length: finalUrl.length,
    },
  };
}

/**
 * Parse Transaction(s) - Enhanced Solana API
 */
export function getHeliusParseTransactionsUrl(): string {
  const key = getApiKey();
  if (!key) return '';
  return `https://api-mainnet.helius-rpc.com/v0/transactions/?api-key=${key}`;
}

/**
 * Parse Transaction History - Enhanced Solana API
 */
export function getHeliusParseTransactionHistoryUrl(address: string): string {
  const key = getApiKey();
  if (!key) return '';
  const encoded = encodeURIComponent(address);
  return `https://api-mainnet.helius-rpc.com/v0/addresses/${encoded}/transactions/?api-key=${key}`;
}

export { MAX_DATA_URL_LENGTH };
