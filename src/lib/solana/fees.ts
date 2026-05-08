import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

export const APP_FEE_BPS = Number((process.env.APP_FEE_BPS ?? '50').trim()); // 0.50%
export const APP_FEE_COLLECTOR_OWNER = new PublicKey(
  (process.env.APP_FEE_COLLECTOR_OWNER ?? '7ZybPucnSryE5BydcARdc4Q2gz1SaospMVRyQ2LCeyRi').trim(),
);

export function getSolanaRpcUrl(): string {
  const rpc = (process.env.SOLANA_RPC_URL ?? '').trim();
  if (!rpc) {
    throw new Error('SOLANA_RPC_URL not configured');
  }
  return rpc;
}

export function getFeeCollectorTokenAccount(mint: string): string {
  const mintPk = new PublicKey(mint);
  const ata = getAssociatedTokenAddressSync(
    mintPk,
    APP_FEE_COLLECTOR_OWNER,
    true,
  );
  return ata.toBase58();
}

export async function getExistingFeeCollectorTokenAccount(mint: string): Promise<string | null> {
  const ata = getFeeCollectorTokenAccount(mint);
  const conn = new Connection(getSolanaRpcUrl(), 'confirmed');
  const info = await conn.getAccountInfo(new PublicKey(ata));
  return info ? ata : null;
}
