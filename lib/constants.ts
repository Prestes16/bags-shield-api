/**
 * Bags Shield App Constants
 */

// Fee destination wallets
export const APP_COSTS_TEAM_WALLET = "3Lwdox6RdkA8BDyxoVNUuvEDGn3rH5f51CzYVujcKxjB";
export const APP_PUBLIC_RESERVE_WALLET = "CEHQL165RAytE3afmWfndkPuKCqBxcMRgZkiEC4tVriq";

// Solana Memo Program ID
export const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

// Fee memo format
export const FEE_MEMO_PREFIX = "BAGS_SHIELD_FEE";

/**
 * Generate fee memo string
 * @param action - Action type (SCAN or SWAP)
 * @param requestId - Unique request identifier
 */
export function generateFeeMemo(action: "SCAN" | "SWAP", requestId: string): string {
  return `${FEE_MEMO_PREFIX}|${action}|${requestId}`;
}
