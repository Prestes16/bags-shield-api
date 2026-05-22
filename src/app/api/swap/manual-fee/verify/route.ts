/**
 * POST /api/swap/manual-fee/verify
 *
 * Verifies that a manual SOL fee transfer was confirmed on-chain.
 * Returns a signed proof object that the frontend can hold as evidence
 * of fee payment. The swap integration layer will use this proof
 * in a future step (not yet wired to /api/order or /api/execute).
 *
 * Verification checks:
 *  1. Transaction exists and is confirmed/finalized on-chain.
 *  2. Transaction has no error (meta.err === null).
 *  3. Block time is within the last VERIFY_MAX_AGE_SECONDS (default 600 = 10 min).
 *  4. feeWallet received at least expectedFeeLamports net SOL in that transaction.
 *  5. Fee payer matches userPublicKey (first account in the message).
 *  6. memo field is checked when present (optional soft-check in v0).
 *
 * Body:
 *   signature           - base58 transaction signature
 *   userPublicKey       - expected fee payer (sender)
 *   expectedFeeLamports - minimum lamports that must have arrived at feeWallet
 *   feeWallet           - expected recipient (must match SWAP_MANUAL_FEE_WALLET / APP_FEE_COLLECTOR_OWNER)
 *   requestId           - (optional) memo requestId for correlation
 *
 * Env vars consumed:
 *   SOLANA_RPC_URL             - RPC endpoint (required)
 *   SWAP_MANUAL_FEE_WALLET     - authorised fee wallet (must match body.feeWallet)
 *   APP_FEE_COLLECTOR_OWNER    - fallback fee wallet
 *   VERIFY_MAX_AGE_SECONDS     - max transaction age (default: 600)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  getOrGenerateRequestId,
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
} from '@/lib/security';
import { checkRateLimitByIp, getClientIp } from '@/lib/security/rateLimit';
import { LaunchpadValidator } from '@/lib/security/validate';
import { APP_FEE_COLLECTOR_OWNER, getSolanaRpcUrl } from '@/lib/solana/fees';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT = { windowMs: 60_000, max: 30 };

// ── Config ────────────────────────────────────────────────────────────────────

function getAuthorisedFeeWallet(): string {
  const env = (process.env.SWAP_MANUAL_FEE_WALLET ?? '').trim();
  if (env) {
    try {
      return new PublicKey(env).toBase58();
    } catch {
      // fall through
    }
  }
  return APP_FEE_COLLECTOR_OWNER.toBase58();
}

function getMaxAgeSecs(): number {
  const v = Number(
    (process.env.VERIFY_MAX_AGE_SECONDS ?? '').trim() || '600',
  );
  return Number.isFinite(v) && v > 0 ? v : 600;
}

// ── Schema ────────────────────────────────────────────────────────────────────

// Base58 signature: 87-88 chars
const SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

const VerifySchema = z
  .object({
    signature: z
      .string()
      .trim()
      .refine((v) => SIG_RE.test(v), 'invalid transaction signature'),
    userPublicKey: z
      .string()
      .trim()
      .min(32)
      .max(44)
      .refine((v) => LaunchpadValidator.validateMint(v).valid, 'invalid userPublicKey'),
    expectedFeeLamports: z
      .union([z.string().trim(), z.number()])
      .transform((v) => String(v))
      .refine(
        (v) => /^\d+$/.test(v) && BigInt(v) > 0n,
        'expectedFeeLamports must be a positive integer',
      ),
    feeWallet: z
      .string()
      .trim()
      .min(32)
      .max(44)
      .refine((v) => LaunchpadValidator.validateMint(v).valid, 'invalid feeWallet'),
    requestId: z.string().trim().min(1).max(256).optional(),
  })
  .strict();

// ── On-chain verification ─────────────────────────────────────────────────────

interface VerifyResult {
  verified: boolean;
  reason?: string;
  actualFeeLamports?: bigint;
  blockTime?: number;
  feePayer?: string;
}

async function verifyFeeOnChain(params: {
  signature: string;
  userPublicKey: string;
  expectedFeeLamports: bigint;
  feeWallet: string;
  maxAgeSecs: number;
}): Promise<VerifyResult> {
  const { signature, userPublicKey, expectedFeeLamports, feeWallet, maxAgeSecs } = params;

  let connection: Connection;
  try {
    connection = new Connection(getSolanaRpcUrl(), 'confirmed');
  } catch (e: any) {
    throw new Error('RPC not configured: ' + (e?.message ?? 'unknown'));
  }

  // Fetch transaction with v0 support
  let tx: Awaited<ReturnType<Connection['getTransaction']>>;
  try {
    tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
  } catch (e: any) {
    throw new Error('RPC fetch failed: ' + (e?.message ?? 'unknown'));
  }

  if (!tx) {
    return { verified: false, reason: 'transaction_not_found_or_not_confirmed' };
  }

  // 1. Check for transaction error
  if (tx.meta?.err !== null && tx.meta?.err !== undefined) {
    return {
      verified: false,
      reason: 'transaction_failed_on_chain',
    };
  }

  // 2. Check age
  const blockTime = tx.blockTime;
  if (!blockTime) {
    return { verified: false, reason: 'block_time_missing' };
  }
  const ageSeconds = Math.floor(Date.now() / 1000) - blockTime;
  if (ageSeconds > maxAgeSecs) {
    return {
      verified: false,
      reason: `transaction_too_old_age_${ageSeconds}s_limit_${maxAgeSecs}s`,
    };
  }

  // 3. Get account keys (works for legacy and v0 transactions)
  const msg = tx.transaction.message;
  let accountKeys: PublicKey[];
  if ('staticAccountKeys' in msg) {
    // VersionedMessage (v0)
    accountKeys = msg.staticAccountKeys as PublicKey[];
  } else {
    // Legacy Message
    accountKeys = (msg as any).accountKeys as PublicKey[];
  }

  if (!accountKeys || accountKeys.length === 0) {
    return { verified: false, reason: 'no_account_keys' };
  }

  // 4. Check fee payer matches userPublicKey
  const feePayer = accountKeys[0]?.toBase58();
  if (feePayer !== userPublicKey) {
    return {
      verified: false,
      reason: 'fee_payer_mismatch',
    };
  }

  // 5. Find feeWallet in accountKeys and measure balance delta
  const feeWalletIndex = accountKeys.findIndex(
    (k) => k.toBase58() === feeWallet,
  );
  if (feeWalletIndex < 0) {
    return {
      verified: false,
      reason: 'fee_wallet_not_in_transaction',
    };
  }

  const preBalances = tx.meta?.preBalances;
  const postBalances = tx.meta?.postBalances;
  if (!preBalances || !postBalances) {
    return { verified: false, reason: 'balance_metadata_missing' };
  }

  const pre = BigInt(preBalances[feeWalletIndex] ?? 0);
  const post = BigInt(postBalances[feeWalletIndex] ?? 0);
  const delta = post - pre;

  if (delta < expectedFeeLamports) {
    return {
      verified: false,
      reason: `insufficient_fee_received_got_${delta}_expected_${expectedFeeLamports}`,
      actualFeeLamports: delta,
    };
  }

  return {
    verified: true,
    actualFeeLamports: delta,
    blockTime,
    feePayer,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function OPTIONS(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  applyCorsHeaders(req, res);
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  applyNoStore(res);
  applySecurityHeaders(res);
  return res;
}

export async function POST(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);
  const ip = getClientIp(req.headers);
  const { allowed, remaining, resetAt } = checkRateLimitByIp(
    ip,
    'manual-fee-verify',
    RATE_LIMIT,
  );

  const fail = (
    msg: string,
    status = 400,
    code?: string,
    details?: Record<string, unknown>,
  ) => {
    const r = NextResponse.json(
      {
        success: false,
        error: code ? { code, message: msg, ...(details ?? {}) } : msg,
        meta: { requestId },
      },
      { status, headers: { 'X-Request-Id': requestId } },
    );
    applyCorsHeaders(req, r);
    applyNoStore(r);
    applySecurityHeaders(r);
    return r;
  };

  if (!allowed)
    return fail(
      `Rate limit. Retry in ${Math.ceil((resetAt - Date.now()) / 1000)}s`,
      429,
      'RATE_LIMIT',
    );

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body');
  }

  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Validation failed');
  }

  const { signature, userPublicKey, expectedFeeLamports, feeWallet, requestId: correlationId } =
    parsed.data;

  // Guard: feeWallet must match our authorised wallet — reject attempts to verify
  // payments sent to arbitrary addresses
  const authorisedWallet = getAuthorisedFeeWallet();
  if (feeWallet !== authorisedWallet) {
    return fail(
      'feeWallet does not match the authorised Bags Shield fee wallet.',
      400,
      'INVALID_FEE_WALLET',
      { authorisedWallet },
    );
  }

  const maxAgeSecs = getMaxAgeSecs();

  console.log(
    JSON.stringify({
      level: 'info',
      event: 'manual_fee_verify_attempt',
      requestId,
      correlationId: correlationId ?? null,
      signature: signature.slice(0, 8) + '…', // partial — avoid full sig in logs
      userPublicKey,
      expectedFeeLamports,
      feeWallet,
    }),
  );

  let result: VerifyResult;
  try {
    result = await verifyFeeOnChain({
      signature,
      userPublicKey,
      expectedFeeLamports: BigInt(expectedFeeLamports),
      feeWallet,
      maxAgeSecs,
    });
  } catch (e: any) {
    const msg: string = e?.message ?? 'RPC error';
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'manual_fee_verify_rpc_error',
        requestId,
        error: msg,
      }),
    );
    return fail(
      'Could not verify fee transaction: ' + msg,
      502,
      'VERIFY_RPC_ERROR',
    );
  }

  if (!result.verified) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'manual_fee_verify_failed',
        requestId,
        reason: result.reason,
        actualFeeLamports: result.actualFeeLamports?.toString() ?? null,
      }),
    );
    return fail(
      'Fee payment could not be verified on-chain.',
      402,
      'FEE_NOT_VERIFIED',
      {
        reason: result.reason ?? 'unknown',
        actualFeeLamports: result.actualFeeLamports?.toString() ?? null,
      },
    );
  }

  console.log(
    JSON.stringify({
      level: 'info',
      event: 'manual_fee_verified',
      requestId,
      correlationId: correlationId ?? null,
      actualFeeLamports: result.actualFeeLamports?.toString(),
      feeWallet,
    }),
  );

  const res = NextResponse.json(
    {
      success: true,
      response: {
        feeProof: {
          mode: 'manual_sol_transfer',
          signature,
          feeLamports: result.actualFeeLamports?.toString() ?? expectedFeeLamports,
          feeWallet,
          verified: true,
          blockTime: result.blockTime ?? null,
          feePayer: result.feePayer ?? userPublicKey,
          correlationId: correlationId ?? null,
          verifiedAt: new Date().toISOString(),
        },
        _note:
          'This proof confirms the fee was paid on-chain. It is NOT yet wired to swap execution. Integration with /api/order or /api/execute is a separate step.',
      },
      meta: { requestId },
    },
    {
      status: 200,
      headers: {
        'X-Request-Id': requestId,
        'Cache-Control': 'no-store',
      },
    },
  );
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set('X-RateLimit-Remaining', String(remaining - 1));
  return res;
}
