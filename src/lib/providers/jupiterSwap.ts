/**
 * Jupiter provider: swap (returns swapTransaction base64).
 * Important: server NEVER signs. Client wallet signs + sends.
 */
import { fetchGuard } from './fetchGuard';
import { circuitAllow, circuitFailure, circuitSuccess } from './circuitBreaker';
import { getExistingFeeCollectorTokenAccount } from '@/lib/solana/fees';

const CB_KEY = 'jupiter:swap';
const BASE = 'https://lite-api.jup.ag/swap/v1';
const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';

export interface JupiterSwapParams {
  quoteResponse: any;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  dynamicComputeUnitLimit?: boolean;
  prioritizationFeeLamports?: number | 'auto';
  asLegacyTransaction?: boolean;
}

export interface JupiterSwapResult {
  ok: boolean;
  latencyMs: number;
  data?: unknown;
  error?: string;
  quality: string[];
}

export async function fetchJupiterSwap(params: JupiterSwapParams): Promise<JupiterSwapResult> {
  if (!circuitAllow(CB_KEY)) {
    return { ok: false, latencyMs: 0, error: 'Circuit open', quality: ['DEGRADED'] };
  }

  const url = `${BASE}/swap`;

  const inputMint = String(params.quoteResponse?.inputMint ?? '');
  const outputMint = String(params.quoteResponse?.outputMint ?? '');

  const feeMintCandidates =
    inputMint === NATIVE_SOL_MINT
      ? [outputMint, inputMint]
      : [inputMint, outputMint];

  let feeAccount: string | undefined;
  let feeMintUsed: string | undefined;

  for (const mint of feeMintCandidates) {
    if (!mint) continue;
    const acc = (await getExistingFeeCollectorTokenAccount(mint)) ?? undefined;
    if (acc) {
      feeAccount = acc;
      feeMintUsed = mint;
      break;
    }
  }

  let quoteResponse = params.quoteResponse;

  if (!feeAccount) {
    const { platformFee, platformFeeBps, feeBps, ...rest } = params.quoteResponse ?? {};
    quoteResponse = rest;
    console.warn(
      `[fees] No compatible fee collector token account for pair ${inputMint} -> ${outputMint}; stripping platform fee and proceeding without app fee.`
    );
  } else {
    console.info(`[fees] Using feeAccount for mint ${feeMintUsed}`);
  }

  const payload: any = {
    quoteResponse,
    userPublicKey: params.userPublicKey,
    wrapAndUnwrapSol: params.wrapAndUnwrapSol ?? true,
    dynamicComputeUnitLimit: params.dynamicComputeUnitLimit ?? true,
    asLegacyTransaction: params.asLegacyTransaction ?? false,
    feeAccount,
  };

  if (params.prioritizationFeeLamports !== undefined) {
    payload.prioritizationFeeLamports = params.prioritizationFeeLamports;
  }

  const r = await fetchGuard<unknown>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    timeoutMs: 15_000,
  });

  if (r.ok && r.data !== undefined) {
    circuitSuccess(CB_KEY);
    return { ok: true, latencyMs: r.latencyMs, data: r.data, quality: [] };
  }

  circuitFailure(CB_KEY);
  return {
    ok: false,
    latencyMs: r.latencyMs,
    error: r.error ?? `HTTP ${r.status}`,
    quality: r.timedOut ? ['TIMEOUT'] : ['DEGRADED'],
  };
}
