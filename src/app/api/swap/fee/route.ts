/**
 * POST /api/swap/fee
 *
 * Builds a single-signature Jupiter Router swap with the Bags Shield fee
 * embedded in the swap transaction via platformFeeBps + feeAccount.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

import {
  getOrGenerateRequestId,
  applyCorsHeaders,
  applyNoStore,
  applySecurityHeaders,
} from '@/lib/security';
import { checkRateLimitByIp, getClientIp } from '@/lib/security/rateLimit';
import { LaunchpadValidator } from '@/lib/security/validate';
import {
  APP_FEE_BPS,
  getSolanaRpcUrl,
  resolvePlatformFeeAccount,
} from '@/lib/solana/fees';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT = { windowMs: 60_000, max: 20 };
const JUPITER_API_KEY = (process.env.JUPITER_API_KEY ?? '').trim();
const JUPITER_BUILD_URL = 'https://api.jup.ag/swap/v2/build';
const COMPUTE_BUDGET_PROGRAM_ID = 'ComputeBudget111111111111111111111111111111';
const MAX_COMPUTE_UNIT_LIMIT = 1_400_000;
const MAX_SOLANA_RAW_TX_BYTES = 1232;
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const FeeSwapSchema = z
  .object({
    inputMint: z
      .string()
      .trim()
      .min(32)
      .max(44)
      .refine((v) => LaunchpadValidator.validateMint(v).valid, 'invalid inputMint'),
    outputMint: z
      .string()
      .trim()
      .min(32)
      .max(44)
      .refine((v) => LaunchpadValidator.validateMint(v).valid, 'invalid outputMint'),
    amount: z.string().trim().min(1).max(30).regex(/^\d+$/, 'amount must be an integer'),
    slippageBps: z.coerce.number().int().min(1).max(5000).optional().default(100),
    userPublicKey: z
      .string()
      .trim()
      .min(32)
      .max(44)
      .refine((v) => LaunchpadValidator.validateMint(v).valid, 'invalid userPublicKey'),
  })
  .strict();

type ApiInstruction = {
  programId: string;
  accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
  data: string;
};

type BuildResponse = {
  inputMint?: string;
  outputMint?: string;
  inAmount?: string;
  outAmount?: string;
  otherAmountThreshold?: string;
  swapMode?: string;
  slippageBps?: number;
  priceImpactPct?: string;
  routePlan?: unknown;
  platformFee?: { amount?: string; feeBps?: number; feeMint?: string };
  platformFeeBps?: number;
  feeBps?: number;
  computeBudgetInstructions?: ApiInstruction[];
  setupInstructions?: ApiInstruction[];
  swapInstruction?: ApiInstruction;
  cleanupInstruction?: ApiInstruction | null;
  otherInstructions?: ApiInstruction[];
  tipInstruction?: ApiInstruction | null;
  addressesByLookupTableAddress?: Record<string, string[]> | null;
  blockhashWithMetadata?: {
    blockhash?: number[] | string;
    lastValidBlockHeight?: number;
  };
};

type RouteAttemptConfig = {
  label: string;
  restrictIntermediateTokens?: boolean;
  maxAccounts?: number;
  onlyDirectRoutes?: boolean;
};

type RouteAttemptMeta = {
  attempt: string;
  restrictIntermediateTokens: boolean | null;
  maxAccounts: number | null;
  onlyDirectRoutes: boolean | null;
  rawTxLength: number | null;
  encodedTxLength: number | null;
  routeHops: number | null;
  upstreamStatus: number | null;
  error: string | null;
};

type SwapCandidate = {
  build: BuildResponse;
  swapTransaction: string;
  rawTxLength: number;
  encodedTxLength: number;
  routeHops: number | null;
  attempt: RouteAttemptConfig;
};

function bytesToBase58(bytes: Uint8Array): string {
  const digits = [0];

  for (const byte of bytes) {
    let carry = byte;
    for (let index = 0; index < digits.length; index += 1) {
      carry += digits[index] << 8;
      digits[index] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let leadingZeroes = 0;
  for (const byte of bytes) {
    if (byte !== 0) break;
    leadingZeroes += 1;
  }

  return '1'.repeat(leadingZeroes) + digits.reverse().map((digit) => BASE58_ALPHABET[digit]).join('');
}

function toInstruction(ix: ApiInstruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map((account) => ({
      pubkey: new PublicKey(account.pubkey),
      isSigner: account.isSigner,
      isWritable: account.isWritable,
    })),
    data: Buffer.from(ix.data, 'base64'),
  });
}

function isSetComputeUnitLimit(ix: ApiInstruction): boolean {
  if (ix.programId !== COMPUTE_BUDGET_PROGRAM_ID) return false;
  return Buffer.from(ix.data, 'base64')[0] === 2;
}

function buildLookupTables(build: BuildResponse): AddressLookupTableAccount[] {
  return Object.entries(build.addressesByLookupTableAddress ?? {}).map(
    ([key, addresses]) =>
      new AddressLookupTableAccount({
        key: new PublicKey(key),
        state: {
          deactivationSlot: 18446744073709551615n,
          lastExtendedSlot: 0,
          lastExtendedSlotStartIndex: 0,
          addresses: addresses.map((address) => new PublicKey(address)),
        },
      }),
  );
}

function getBlockhash(build: BuildResponse): string {
  const blockhash = build.blockhashWithMetadata?.blockhash;
  if (typeof blockhash === 'string') return blockhash;
  if (Array.isArray(blockhash)) return bytesToBase58(Uint8Array.from(blockhash));
  throw new Error('Jupiter /build response is missing blockhashWithMetadata.blockhash');
}

function buildUnsignedTransaction(build: BuildResponse, userPublicKey: string): VersionedTransaction {
  if (!build.swapInstruction) {
    throw new Error('Jupiter /build response is missing swapInstruction');
  }

  const computeBudgetInstructions = (build.computeBudgetInstructions ?? [])
    .filter((ix) => !isSetComputeUnitLimit(ix))
    .map(toInstruction);
  const setupInstructions = (build.setupInstructions ?? []).map(toInstruction);
  const cleanupInstructions = build.cleanupInstruction ? [toInstruction(build.cleanupInstruction)] : [];
  const otherInstructions = (build.otherInstructions ?? []).map(toInstruction);
  const tipInstructions = build.tipInstruction ? [toInstruction(build.tipInstruction)] : [];

  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: MAX_COMPUTE_UNIT_LIMIT }),
    ...computeBudgetInstructions,
    ...setupInstructions,
    toInstruction(build.swapInstruction),
    ...cleanupInstructions,
    ...otherInstructions,
    ...tipInstructions,
  ];

  const message = new TransactionMessage({
    payerKey: new PublicKey(userPublicKey),
    recentBlockhash: getBlockhash(build),
    instructions,
  }).compileToV0Message(buildLookupTables(build));

  return new VersionedTransaction(message);
}

function buildContainsFeeAccount(build: BuildResponse, feeAccount: string): boolean {
  const instructions = [
    ...(build.setupInstructions ?? []),
    ...(build.swapInstruction ? [build.swapInstruction] : []),
    ...(build.cleanupInstruction ? [build.cleanupInstruction] : []),
    ...(build.otherInstructions ?? []),
    ...(build.tipInstruction ? [build.tipInstruction] : []),
  ];

  return instructions.some((ix) => ix.accounts.some((account) => account.pubkey === feeAccount));
}

function validateFeeApplied(build: BuildResponse, feeAccount: string, feeBps: number): string | null {
  const returnedFeeBps = Number(
    build.platformFee?.feeBps ?? build.platformFeeBps ?? build.feeBps ?? feeBps,
  );

  if (!Number.isFinite(returnedFeeBps) || returnedFeeBps < feeBps) {
    return `Jupiter returned feeBps=${Number.isFinite(returnedFeeBps) ? returnedFeeBps : 'null'}`;
  }

  if (!buildContainsFeeAccount(build, feeAccount)) {
    return 'Jupiter build response does not include the selected feeAccount in swap instructions';
  }

  return null;
}

function getRouteHops(routePlan: unknown): number | null {
  return Array.isArray(routePlan) ? routePlan.length : null;
}

function describeAttempt(
  attempt: RouteAttemptConfig,
): Omit<
  RouteAttemptMeta,
  'rawTxLength' | 'encodedTxLength' | 'routeHops' | 'upstreamStatus' | 'error'
> {
  return {
    attempt: attempt.label,
    restrictIntermediateTokens: attempt.restrictIntermediateTokens ?? null,
    maxAccounts: attempt.maxAccounts ?? null,
    onlyDirectRoutes: attempt.onlyDirectRoutes ?? null,
  };
}

function buildAttemptParams(baseParams: URLSearchParams, attempt: RouteAttemptConfig): URLSearchParams {
  const params = new URLSearchParams(baseParams);
  if (typeof attempt.restrictIntermediateTokens === 'boolean') {
    params.set('restrictIntermediateTokens', String(attempt.restrictIntermediateTokens));
  }
  if (typeof attempt.maxAccounts === 'number') {
    params.set('maxAccounts', String(attempt.maxAccounts));
  }
  if (typeof attempt.onlyDirectRoutes === 'boolean') {
    params.set('onlyDirectRoutes', String(attempt.onlyDirectRoutes));
  }
  return params;
}

function routeAttemptMeta(
  attempt: RouteAttemptConfig,
  details: Partial<Omit<RouteAttemptMeta, 'attempt' | 'restrictIntermediateTokens' | 'maxAccounts' | 'onlyDirectRoutes'>>,
): RouteAttemptMeta {
  return {
    ...describeAttempt(attempt),
    rawTxLength: details.rawTxLength ?? null,
    encodedTxLength: details.encodedTxLength ?? null,
    routeHops: details.routeHops ?? null,
    upstreamStatus: details.upstreamStatus ?? null,
    error: details.error ?? null,
  };
}

function fail(
  req: NextRequest,
  requestId: string,
  msg: string,
  status = 400,
  code?: string,
  details?: Record<string, unknown>,
) {
  const res = NextResponse.json(
    {
      success: false,
      error: code ? { code, message: msg, ...(details ?? {}) } : msg,
      meta: { requestId },
    },
    { status, headers: { 'X-Request-Id': requestId } },
  );
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  return res;
}

function failWithMeta(
  req: NextRequest,
  requestId: string,
  msg: string,
  status: number,
  code: string,
  meta: Record<string, unknown>,
  details?: Record<string, unknown>,
) {
  const res = NextResponse.json(
    {
      success: false,
      error: { code, message: msg, ...(details ?? {}) },
      meta: { requestId, ...meta },
    },
    { status, headers: { 'X-Request-Id': requestId } },
  );
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  return res;
}

export async function OPTIONS(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);
  const res = new NextResponse(null, { status: 204 });
  applyCorsHeaders(req, res);
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set('X-Request-Id', requestId);
  return res;
}

export async function POST(req: NextRequest) {
  const requestId = getOrGenerateRequestId(req.headers);
  const ip = getClientIp(req.headers);
  const { allowed, remaining, resetAt } = checkRateLimitByIp(ip, 'swap-fee', RATE_LIMIT);

  if (!allowed) {
    return fail(
      req,
      requestId,
      `Rate limit. Retry in ${Math.ceil((resetAt - Date.now()) / 1000)}s`,
      429,
      'RATE_LIMIT',
    );
  }

  if (!JUPITER_API_KEY) {
    return fail(
      req,
      requestId,
      'JUPITER_API_KEY is required for Jupiter /swap/v2/build; swap disabled to avoid zero-fee execution.',
      503,
      'SWAP_FEE_API_KEY_REQUIRED',
    );
  }

  const feeBps = APP_FEE_BPS;
  if (!Number.isInteger(feeBps) || feeBps <= 0 || feeBps > 255) {
    return fail(req, requestId, 'Invalid APP_FEE_BPS configuration.', 500, 'SWAP_FEE_CONFIG_INVALID');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(req, requestId, 'Invalid JSON body');
  }

  const parsed = FeeSwapSchema.safeParse(body);
  if (!parsed.success) {
    return fail(req, requestId, parsed.error.issues[0]?.message ?? 'Validation failed');
  }

  const { inputMint, outputMint, amount, slippageBps, userPublicKey } = parsed.data;
  let connection: Connection;
  try {
    connection = new Connection(getSolanaRpcUrl(), 'confirmed');
  } catch (e: any) {
    return fail(
      req,
      requestId,
      e?.message ?? 'SOLANA_RPC_URL not configured',
      503,
      'SOLANA_RPC_NOT_CONFIGURED',
    );
  }

  let feeAccount: string;
  let feeMint: string;
  let feeAccountSource: string;
  try {
    const resolved = await resolvePlatformFeeAccount(connection, inputMint, outputMint);
    feeAccount = resolved.feeAccount;
    feeMint = resolved.feeMint;
    feeAccountSource = resolved.source;
  } catch (e: any) {
    return fail(
      req,
      requestId,
      'No valid Bags Shield fee account is available for this route; swap disabled to avoid zero-fee execution.',
      503,
      'SWAP_FEE_NOT_CONFIGURED',
      { reason: e?.message ?? 'fee account unavailable' },
    );
  }

  const baseParams = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    taker: userPublicKey,
    slippageBps: String(slippageBps),
    platformFeeBps: String(feeBps),
    feeAccount,
  });

  const t0 = Date.now();
  const routeAttempts: RouteAttemptConfig[] = [
    { label: 'normal' },
    { label: 'restrict-intermediate', restrictIntermediateTokens: true },
    { label: 'max-accounts-48', restrictIntermediateTokens: true, maxAccounts: 48 },
    { label: 'max-accounts-40', restrictIntermediateTokens: true, maxAccounts: 40 },
    { label: 'max-accounts-32', restrictIntermediateTokens: true, maxAccounts: 32 },
    { label: 'direct-only', onlyDirectRoutes: true },
  ];
  const attempts: RouteAttemptMeta[] = [];
  let candidate: SwapCandidate | null = null;
  let lastFeeValidationError: string | null = null;

  for (const attempt of routeAttempts) {
    const attemptParams = buildAttemptParams(baseParams, attempt);

    try {
      const upstream = await fetch(`${JUPITER_BUILD_URL}?${attemptParams}`, {
        headers: {
          Accept: 'application/json',
          'x-api-key': JUPITER_API_KEY,
        },
        cache: 'no-store',
      });
      const data = await upstream.json().catch(() => null);

      if (!upstream.ok) {
        attempts.push(
          routeAttemptMeta(attempt, {
            upstreamStatus: upstream.status,
            error: data?.error ?? data?.message ?? `Jupiter build error (${upstream.status})`,
          }),
        );
        continue;
      }

      const build = data as BuildResponse;
      const routeHops = getRouteHops(build.routePlan);
      const feeValidationError = validateFeeApplied(build, feeAccount, feeBps);
      if (feeValidationError) {
        lastFeeValidationError = feeValidationError;
        attempts.push(routeAttemptMeta(attempt, { routeHops, error: feeValidationError }));
        continue;
      }

      const transaction = buildUnsignedTransaction(build, userPublicKey);
      const requiredSignatures = transaction.message.header.numRequiredSignatures;
      const requiredSigner = transaction.message.staticAccountKeys[0]?.toBase58();
      if (requiredSignatures !== 1 || requiredSigner !== userPublicKey) {
        return fail(
          req,
          requestId,
          'Jupiter transaction requires an unexpected signer set; swap disabled.',
          502,
          'JUPITER_BUILD_INVALID_SIGNERS',
          { requiredSignatures, requiredSigner },
        );
      }

      const serialized = Buffer.from(transaction.serialize());
      const swapTransaction = serialized.toString('base64');
      const rawTxLength = serialized.length;
      const encodedTxLength = swapTransaction.length;

      if (rawTxLength > MAX_SOLANA_RAW_TX_BYTES) {
        attempts.push(
          routeAttemptMeta(attempt, {
            rawTxLength,
            encodedTxLength,
            routeHops,
            error: 'swap transaction exceeds Solana raw transaction size limit',
          }),
        );
        console.warn('[swap-fee] Jupiter route transaction too large', {
          requestId,
          attempt: attempt.label,
          rawTxLength,
          encodedTxLength,
          routeHops,
          maxAccounts: attempt.maxAccounts ?? null,
          restrictIntermediateTokens: attempt.restrictIntermediateTokens ?? null,
          onlyDirectRoutes: attempt.onlyDirectRoutes ?? null,
        });
        continue;
      }

      attempts.push(routeAttemptMeta(attempt, { rawTxLength, encodedTxLength, routeHops }));
      candidate = {
        build,
        swapTransaction,
        rawTxLength,
        encodedTxLength,
        routeHops,
        attempt,
      };
      break;
    } catch (e: any) {
      attempts.push(
        routeAttemptMeta(attempt, {
          error: e?.message ?? 'Jupiter build unavailable',
        }),
      );
    }
  }

  if (!candidate) {
    const latencyMs = Date.now() - t0;
    if (lastFeeValidationError) {
      return failWithMeta(
        req,
        requestId,
        'Jupiter did not include the Bags Shield platform fee; swap disabled to avoid zero-fee execution.',
        502,
        'SWAP_FEE_NOT_APPLIED',
        { latencyMs, source: 'jupiter-v2-build', attempts },
        {
          requestedFeeBps: feeBps,
          feeMint,
          feeAccount,
          reason: lastFeeValidationError,
        },
      );
    }

    return failWithMeta(
      req,
      requestId,
      'A rota encontrada gerou uma transação grande demais. Tente um valor menor, outro token ou uma rota direta.',
      422,
      'SWAP_ROUTE_TX_TOO_LARGE',
      { latencyMs, source: 'jupiter-v2-build', attempts },
    );
  }

  const latencyMs = Date.now() - t0;
  const { build } = candidate;
  const res = NextResponse.json(
    {
      success: true,
      response: {
        swapTransaction: candidate.swapTransaction,
        inputMint: build.inputMint ?? inputMint,
        outputMint: build.outputMint ?? outputMint,
        inAmount: build.inAmount ?? amount,
        outAmount: build.outAmount,
        otherAmountThreshold: build.otherAmountThreshold,
        swapMode: build.swapMode ?? 'ExactIn',
        slippageBps: build.slippageBps ?? slippageBps,
        priceImpactPct: build.priceImpactPct,
        routePlan: build.routePlan,
        feeBps,
        feeMint,
        feeAccount,
        feeAccountSource,
        feeMode: 'platform_fee_in_swap',
        requiresSingleUserSignature: true,
        platformFee: build.platformFee ?? {
          feeBps,
          feeMint,
          amount: null,
        },
        blockhash: getBlockhash(build),
        lastValidBlockHeight: build.blockhashWithMetadata?.lastValidBlockHeight ?? null,
      },
      meta: {
        requestId,
        latencyMs,
        source: 'jupiter-v2-build',
        selectedAttempt: candidate.attempt.label,
        rawTxLength: candidate.rawTxLength,
        encodedTxLength: candidate.encodedTxLength,
        routeHops: candidate.routeHops,
        attempts,
      },
    },
    { status: 200, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } },
  );
  applyCorsHeaders(req, res);
  applyNoStore(res);
  applySecurityHeaders(res);
  res.headers.set('X-RateLimit-Remaining', String(remaining - 1));
  return res;
}
