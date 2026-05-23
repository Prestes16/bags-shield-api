import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

// ── Jupiter Referral Program ──────────────────────────────────────────────────
// Jupiter Ultra requires referral program PDAs — standard ATAs are silently ignored.
const REFERRAL_PROGRAM_ID = new PublicKey('REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3');

/**
 * Derives the referral token account PDA for a given mint.
 * This is the account that must be passed as `feeAccount` in Jupiter Ultra orders.
 * The referral account must be initialized on-chain first (run setup-jupiter-referral.mjs).
 */
export function getReferralTokenAccount(referralAccountPubkey: PublicKey, mint: string): string {
  const mintPk = new PublicKey(mint);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('referral_ata'), referralAccountPubkey.toBuffer(), mintPk.toBuffer()],
    REFERRAL_PROGRAM_ID,
  );
  return pda.toBase58();
}

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

export const WSOL_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
export const JUP_MINT = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN';

const FEE_ACCOUNT_ENV_BY_MINT: Record<string, string> = {
  [USDC_MINT]: 'JUPITER_FEE_ACCOUNT_USDC',
  [WSOL_MINT]: 'JUPITER_FEE_ACCOUNT_WSOL',
  [USDT_MINT]: 'JUPITER_FEE_ACCOUNT_USDT',
  [JUP_MINT]: 'JUPITER_FEE_ACCOUNT_JUP',
};

export type PlatformFeeAccount = {
  feeMint: string;
  feeAccount: string;
  source: 'env' | 'collector_ata';
};

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

function getConfiguredFeeAccount(mint: string): PlatformFeeAccount {
  const normalizedMint = new PublicKey(mint).toBase58();
  const envName = FEE_ACCOUNT_ENV_BY_MINT[normalizedMint];
  const configured = envName ? (process.env[envName] ?? '').trim() : '';

  if (configured) {
    return {
      feeMint: normalizedMint,
      feeAccount: new PublicKey(configured).toBase58(),
      source: 'env',
    };
  }

  return {
    feeMint: normalizedMint,
    feeAccount: getFeeCollectorTokenAccount(normalizedMint),
    source: 'collector_ata',
  };
}

export async function validateFeeTokenAccount(
  connection: Connection,
  feeMint: string,
  feeAccount: string,
): Promise<{ valid: boolean; reason?: string }> {
  const expectedMint = new PublicKey(feeMint).toBase58();
  const expectedOwner = APP_FEE_COLLECTOR_OWNER.toBase58();
  const accountPk = new PublicKey(feeAccount);
  const accountInfo = await connection.getParsedAccountInfo(accountPk, 'confirmed');

  if (!accountInfo.value) return { valid: false, reason: 'fee account does not exist' };

  const data = accountInfo.value.data as any;
  const parsed = data?.parsed;
  const info = parsed?.info;

  if (!parsed || parsed.type !== 'account') {
    return { valid: false, reason: 'fee account is not a parsed token account' };
  }

  if (data.program !== 'spl-token' && data.program !== 'spl-token-2022') {
    return { valid: false, reason: 'fee account is not owned by a token program' };
  }

  if (info?.mint !== expectedMint) {
    return { valid: false, reason: 'fee account mint mismatch' };
  }

  if (info?.owner !== expectedOwner) {
    return { valid: false, reason: 'fee account owner mismatch' };
  }

  return { valid: true };
}

export async function resolvePlatformFeeAccount(
  connection: Connection,
  inputMint: string,
  outputMint: string,
): Promise<PlatformFeeAccount> {
  const candidates = Array.from(
    new Set([
      new PublicKey(outputMint).toBase58(),
      new PublicKey(inputMint).toBase58(),
    ]),
  );
  const failures: string[] = [];

  for (const mint of candidates) {
    let candidate: PlatformFeeAccount;
    try {
      candidate = getConfiguredFeeAccount(mint);
    } catch (e: any) {
      failures.push(`${mint}: ${e?.message ?? 'invalid fee account'}`);
      continue;
    }

    const validation = await validateFeeTokenAccount(
      connection,
      candidate.feeMint,
      candidate.feeAccount,
    );

    if (validation.valid) return candidate;
    failures.push(`${candidate.feeMint}: ${validation.reason}`);
  }

  throw new Error(`No valid Jupiter fee account for this pair. ${failures.join('; ')}`);
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
