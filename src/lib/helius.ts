/**
 * Helius API client utilities.
 * Aceita HELIUS_RPC_URL (URL completa com api-key) OU HELIUS_API_KEY (só a key).
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

/** HELIUS_RPC_URL válida: URL com helius no host */
function isRpcUrlValid(url: string): boolean {
  if (!url || url.length < 30) return false;
  try {
    const u = new URL(url);
    const host = (u.hostname ?? '').toLowerCase();
    return (u.protocol === 'http:' || u.protocol === 'https:') && host.includes('helius');
  } catch {
    return false;
  }
}

/**
 * Helius está configurado se:
 * - HELIUS_RPC_URL existe e parece URL válida (helius no host)
 * - OU HELIUS_API_KEY existe, len >= 30, não é placeholder
 */
export function isHeliusConfigured(): boolean {
  const rpcUrl = getRpcUrlRaw();
  if (isRpcUrlValid(rpcUrl)) return true;

  const key = getApiKeyRaw();
  if (!key || key.length < 30) return false;
  if (looksPlaceholder(key)) return false;
  return true;
}

/** Obtém a API key: da URL ou de HELIUS_API_KEY */
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
 * Prioridade: HELIUS_RPC_URL > montada a partir de HELIUS_API_KEY
 */
export function getHeliusRpcUrl(): string {
  const rpcUrl = getRpcUrlRaw();
  if (isRpcUrlValid(rpcUrl)) return rpcUrl;
  const key = getApiKey();
  if (!key) return '';
  return `https://mainnet.helius-rpc.com/?api-key=${key}`;
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
