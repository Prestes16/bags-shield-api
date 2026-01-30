/**
 * Solana transaction utilities for fee payments
 */

import {
  Transaction,
  SystemProgram,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  APP_COSTS_TEAM_WALLET,
  APP_PUBLIC_RESERVE_WALLET,
  MEMO_PROGRAM_ID,
  generateFeeMemo,
} from "@/lib/constants";
import { splitFeeLamports2Way } from "@/lib/fees";

/**
 * Build a fee payment transaction with memo
 * @param userPublicKey - User's wallet public key
 * @param feeTotal - Total fee in lamports
 * @param action - Action type (SCAN or SWAP)
 * @param requestId - Unique request identifier
 * @returns Transaction ready to be signed
 */
export function buildFeeTransaction(
  userPublicKey: PublicKey,
  feeTotal: bigint,
  action: "SCAN" | "SWAP",
  requestId: string
): Transaction {
  const transaction = new Transaction();
  
  // Split fees between two wallets
  const { costs, reserve } = splitFeeLamports2Way(feeTotal);
  
  // Convert string addresses to PublicKey
  const costsWallet = new PublicKey(APP_COSTS_TEAM_WALLET);
  const reserveWallet = new PublicKey(APP_PUBLIC_RESERVE_WALLET);
  
  // Add transfer instruction for costs/team (35%)
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: userPublicKey,
      toPubkey: costsWallet,
      lamports: Number(costs),
    })
  );
  
  // Add transfer instruction for public reserve (65%)
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: userPublicKey,
      toPubkey: reserveWallet,
      lamports: Number(reserve),
    })
  );
  
  // Add memo instruction for traceability
  const memo = generateFeeMemo(action, requestId);
  const memoInstruction = new TransactionInstruction({
    keys: [],
    programId: new PublicKey(MEMO_PROGRAM_ID),
    data: Buffer.from(memo, "utf-8"),
  });
  transaction.add(memoInstruction);
  
  return transaction;
}

/**
 * Generate a unique request ID (UUID v4)
 */
export function generateRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
