/**
 * Bags Shield Fee System
 * 
 * All fee calculations use BigInt to avoid floating-point precision issues.
 * Fees are split between two wallets:
 * - 35% → Costs/Team (operations + payroll)
 * - 65% → Public Reserve (improvements + potential airdrops)
 */

// Base constants
export const LAMPORTS_PER_SOL = 1_000_000_000n;

// SCAN fees (cheap, anti-spam)
export const FEE_SCAN_MIN_LAMPORTS = 10_000n;         // 0.00001 SOL
export const FEE_SCAN_CAP_LAMPORTS = 10_000n;         // Fixed at minimum (scan doesn't scale)

// SWAP fees (fair: small base + low bps + cap)
export const FEE_SWAP_BASE_LAMPORTS = 15_000n;        // 0.000015 SOL
export const FEE_SWAP_RATE_BPS = 5n;                  // 0.05% of value (much lower than 0.1%+)
export const FEE_SWAP_CAP_LAMPORTS = 1_000_000n;      // 0.001 SOL cap (protects large trades)

// Fee distribution percentages
export const COSTS_SHARE_PCT = 35n;
export const RESERVE_SHARE_PCT = 65n;

/**
 * Clamp a BigInt value between min and max
 */
export function clampLamports(x: bigint, min: bigint, max: bigint): bigint {
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

/**
 * Compute scan fee (fixed, anti-spam)
 * @returns Total fee in lamports
 */
export function computeScanFeeLamports(): bigint {
  return clampLamports(
    FEE_SCAN_MIN_LAMPORTS,
    FEE_SCAN_MIN_LAMPORTS,
    FEE_SCAN_CAP_LAMPORTS
  );
}

/**
 * Compute swap fee (base + variable with cap)
 * @param amountValueLamports - SOL-equivalent value of the swap in lamports
 * @returns Total fee in lamports
 */
export function computeSwapFeeLamports(amountValueLamports: bigint): bigint {
  const raw = FEE_SWAP_BASE_LAMPORTS + (amountValueLamports * FEE_SWAP_RATE_BPS) / 10_000n;
  return clampLamports(raw, FEE_SWAP_BASE_LAMPORTS, FEE_SWAP_CAP_LAMPORTS);
}

/**
 * Split fee between two wallets (35% costs, 65% reserve)
 * Uses integer division for costs, remainder goes to reserve (ensures exact sum)
 * @param feeTotal - Total fee in lamports
 * @returns Object with costs and reserve amounts
 */
export function splitFeeLamports2Way(feeTotal: bigint): {
  costs: bigint;
  reserve: bigint;
} {
  const costs = (feeTotal * COSTS_SHARE_PCT) / 100n;
  const reserve = feeTotal - costs;
  
  return { costs, reserve };
}

/**
 * Format lamports to SOL string without using floats
 * @param lamports - Amount in lamports
 * @returns Formatted string like "0.000015 SOL"
 */
export function formatLamportsToSolString(lamports: bigint): string {
  const lamportsStr = lamports.toString();
  const lamportsPerSolStr = LAMPORTS_PER_SOL.toString();
  
  // Pad with leading zeros if needed
  const paddedLamports = lamportsStr.padStart(lamportsPerSolStr.length, '0');
  
  // Split into integer and decimal parts
  const integerPart = paddedLamports.slice(0, -9) || '0';
  const decimalPart = paddedLamports.slice(-9);
  
  // Remove trailing zeros from decimal part
  const trimmedDecimal = decimalPart.replace(/0+$/, '');
  
  if (trimmedDecimal) {
    return `${integerPart}.${trimmedDecimal} SOL`;
  }
  
  return `${integerPart} SOL`;
}

/**
 * Serialize BigInt to string for JSON
 */
export function serializeBigInt(value: bigint): string {
  return value.toString();
}

/**
 * Deserialize string to BigInt
 */
export function deserializeBigInt(value: string): bigint {
  return BigInt(value);
}
