/**
 * Jupiter provider: swap (returns swapTransaction base64).
 * Important: server NEVER signs. Client wallet signs + sends.
 */
import { fetchGuard } from './fetchGuard';
import { circuitAllow, circuitFailure, circuitSuccess } from './circuitBreaker';
import { getFeeCollectorTokenAccount, APP_FEE_BPS } from '@/lib/solana/fees';

const CB_KEY = 'jupiter:swap';
const JUPITER_API_KEY = (process.env.JUPITER_API_KEY ?? '').trim();
const BASE = JUPITER_API_KEY ? 'https://api.jup.ag/swap/v1' : 'https://lite-api.jup.ag/swap/v1';
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

  // Prefer the non-SOL side so Jupiter can retain the fee token.
  // Fall back to WSOL when both sides are native.
  const feeMintCandidates =
    inputMint === NATIVE_SOL_MINT
      ? [outputMint, inputMint]
      : [inputMint, outputMint];

  let feeAccount: string | undefined;
  let feeMintUsed: string | undefined;

  for (const mint of feeMintCandidates) {
    if (!mint) continue;
    try {
      feeAccount = getFeeCollectorTokenAccount(mint);
      feeMintUsed = mint;
      break;
    } catch {
      // invalid mint — skip
    }
  }

  // Always preserve the platformFee fields that Jupiter embedded in the quote.
  // Never strip them: stripping means zero fees even when the ATA exists.
  let quoteResponse = params.quoteResponse;
  if (!quoteResponse?.platformFeeBps && feeAccount) {
    // Patch in the fee bps if the client-provided quote is missing it
    // (e.g. when called server-side without a prior /api/quote call).
    quoteResponse = { ...quoteResponse, platformFeeBps: APP_FEE_BPS };
  }

  console.info(`[fees] feeAccount=${feeAccount ?? 'none'} mint=${feeMintUsed ?? 'none'} pair=${inputMint}->${outputMint}`);

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
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(JUPITER_API_KEY ? { 'x-api-key': JUPITER_API_KEY } : {}),
    },
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
