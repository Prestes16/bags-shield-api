import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

export const APP_FEE_BPS = Number((process.env.APP_FEE_BPS ?? '50').trim() || '50'); // 0.50%

// Fallback hardcoded — garante que nunca vai ser string vazia ou undefined
const FALLBACK_FEE_COLLECTOR = '7ZybPucnSryE5BydcARdc4Q2gz1SaospMVRyQ2LCeyRi';

function buildFeeCollector(): PublicKey {
  const raw = (process.env.APP_FEE_COLLECTOR_OWNER ?? '').trim() || FALLBACK_FEE_COLLECTOR;
  try {
    return new PublicKey(raw);
  } catch {
    return new PublicKey(FALLBACK_FEE_COLLECTOR);
  }
}

export const APP_FEE_COLLECTOR_OWNER: PublicKey = buildFeeCollector();

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

// Bags Shield launch fees
export const LAUNCH_FEE_LAMPORTS = BigInt(
  (process.env.LAUNCH_FEE_LAMPORTS ?? '20000000').trim() || '20000000'
); // 0.02 SOL default

export const SHIELD_TIER_EXTRA_LAMPORTS = BigInt(
  (process.env.SHIELD_TIER_FEE_LAMPORTS ?? '30000000').trim() || '30000000'
); // +0.03 SOL when all trust layers are active

export function getLaunchFee(allLayersActive: boolean): bigint {
  return LAUNCH_FEE_LAMPORTS + (allLayersActive ? SHIELD_TIER_EXTRA_LAMPORTS : 0n);
}

export function getTreasuryWallet(): string | null {
  return (process.env.TREASURY_WALLET_ADDRESS ?? '').trim() || '7ZybPucnSryE5BydcARdc4Q2gz1SaospMVRyQ2LCeyRi';
}
