import { PublicKey } from "@solana/web3.js";

export const DEFAULT_LAUNCHPAD_TREASURY_WALLET =
  "7ZybPucnSryE5BydcARdc4Q2gz1SaospMVRyQ2LCeyRi";

const DEFAULTS = {
  feesEnabled: true,
  feeMode: "tipWallet_plus_feeShare",
  baseFeeLamports: 20_000_000n,
  verifiedFeeLamports: 30_000_000n,
  liquidityFreeThresholdLamports: 250_000_000n,
  liquidityTier1EndLamports: 2_000_000_000n,
  liquidityTier2EndLamports: 10_000_000_000n,
  liquidityFeeBpsLow: 125,
  liquidityFeeBpsMid: 100,
  liquidityFeeBpsHigh: 75,
  liquidityFeeCapLamports: 250_000_000n,
  creatorShareBps: 9500,
  bagsShieldShareBps: 500,
};

export interface LaunchpadFeeQuoteInput {
  wallet: string;
  verified?: boolean;
  initialBuyLamports?: number;
  extraTipLamports?: number;
}

export interface LaunchpadFeeQuote {
  feesEnabled: boolean;
  feeMode: string;
  treasuryWallet: string;
  baseFeeLamports: number;
  verifiedFeeLamports: number;
  liquidityFeeLamports: number;
  extraTipLamports: number;
  totalPlatformFeeLamports: number;
  totalTipLamports: number;
  creatorFeeShareBps: number;
  bagsShieldFeeShareBps: number;
  totalBps: number;
  estimatedNetworkFeeLamports: null;
  estimatedRentLamports: null;
  disclaimer: string;
}

export interface LaunchpadFeeSettings {
  feesEnabled: boolean;
  feeMode: string;
  treasuryWallet: string;
  baseFeeLamports: bigint;
  verifiedFeeLamports: bigint;
  liquidityFreeThresholdLamports: bigint;
  liquidityTier1EndLamports: bigint;
  liquidityTier2EndLamports: bigint;
  liquidityFeeBpsLow: number;
  liquidityFeeBpsMid: number;
  liquidityFeeBpsHigh: number;
  liquidityFeeCapLamports: bigint;
  creatorShareBps: number;
  bagsShieldShareBps: number;
}

function envString(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function envBoolean(name: string, fallback: boolean): boolean {
  const value = envString(name);
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function envBigInt(name: string, fallback: bigint): bigint {
  const value = envString(name);
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) return fallback;
  return BigInt(value);
}

function envInteger(name: string, fallback: number): number {
  const value = envString(name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return fallback;
  return parsed;
}

function toSafeNumber(value: bigint, field: string): number {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (value > max) {
    throw new Error(`${field} exceeds safe integer range`);
  }
  return Number(value);
}

function validatePublicKey(value: string, field: string): string {
  try {
    return new PublicKey(value).toBase58();
  } catch {
    throw new Error(`${field} must be a valid Solana public key`);
  }
}

function feeForRange(amountLamports: bigint, bps: number): bigint {
  if (amountLamports <= 0n || bps <= 0) return 0n;
  return (amountLamports * BigInt(bps)) / 10_000n;
}

export function getLaunchpadFeeSettings(): LaunchpadFeeSettings {
  const treasuryWallet = validatePublicKey(
    envString("LAUNCHPAD_TREASURY_WALLET") || DEFAULT_LAUNCHPAD_TREASURY_WALLET,
    "LAUNCHPAD_TREASURY_WALLET",
  );

  const settings: LaunchpadFeeSettings = {
    feesEnabled: envBoolean("LAUNCHPAD_FEES_ENABLED", DEFAULTS.feesEnabled),
    feeMode: envString("LAUNCHPAD_FEE_MODE") || DEFAULTS.feeMode,
    treasuryWallet,
    baseFeeLamports: envBigInt("LAUNCHPAD_BASE_FEE_LAMPORTS", DEFAULTS.baseFeeLamports),
    verifiedFeeLamports: envBigInt("LAUNCHPAD_VERIFIED_FEE_LAMPORTS", DEFAULTS.verifiedFeeLamports),
    liquidityFreeThresholdLamports: envBigInt(
      "LAUNCHPAD_LIQUIDITY_FREE_THRESHOLD_LAMPORTS",
      DEFAULTS.liquidityFreeThresholdLamports,
    ),
    liquidityTier1EndLamports: envBigInt(
      "LAUNCHPAD_LIQUIDITY_TIER_1_END_LAMPORTS",
      DEFAULTS.liquidityTier1EndLamports,
    ),
    liquidityTier2EndLamports: envBigInt(
      "LAUNCHPAD_LIQUIDITY_TIER_2_END_LAMPORTS",
      DEFAULTS.liquidityTier2EndLamports,
    ),
    liquidityFeeBpsLow: envInteger("LAUNCHPAD_LIQUIDITY_FEE_BPS_LOW", DEFAULTS.liquidityFeeBpsLow),
    liquidityFeeBpsMid: envInteger("LAUNCHPAD_LIQUIDITY_FEE_BPS_MID", DEFAULTS.liquidityFeeBpsMid),
    liquidityFeeBpsHigh: envInteger("LAUNCHPAD_LIQUIDITY_FEE_BPS_HIGH", DEFAULTS.liquidityFeeBpsHigh),
    liquidityFeeCapLamports: envBigInt(
      "LAUNCHPAD_LIQUIDITY_FEE_CAP_LAMPORTS",
      DEFAULTS.liquidityFeeCapLamports,
    ),
    creatorShareBps: envInteger("LAUNCHPAD_CREATOR_SHARE_BPS", DEFAULTS.creatorShareBps),
    bagsShieldShareBps: envInteger("LAUNCHPAD_FEE_SHARE_BPS", DEFAULTS.bagsShieldShareBps),
  };

  const totalBps = settings.creatorShareBps + settings.bagsShieldShareBps;
  if (settings.feesEnabled && totalBps !== 10000) {
    throw new Error("Launchpad fee-share BPS must total 10000");
  }

  if (
    settings.liquidityFreeThresholdLamports > settings.liquidityTier1EndLamports ||
    settings.liquidityTier1EndLamports > settings.liquidityTier2EndLamports
  ) {
    throw new Error("Launchpad liquidity fee tiers are misconfigured");
  }

  if (
    settings.liquidityFeeBpsLow > 10000 ||
    settings.liquidityFeeBpsMid > 10000 ||
    settings.liquidityFeeBpsHigh > 10000
  ) {
    throw new Error("Launchpad liquidity fee BPS values must be <= 10000");
  }

  if (settings.feesEnabled && settings.feeMode !== DEFAULTS.feeMode) {
    throw new Error("Platform fee collection is not available; launch disabled until fee mode is configured.");
  }

  return settings;
}

export function calculateLiquidityFeeLamports(
  initialBuyLamports: bigint,
  settings: LaunchpadFeeSettings = getLaunchpadFeeSettings(),
): bigint {
  if (initialBuyLamports <= settings.liquidityFreeThresholdLamports) return 0n;

  const tier1End = initialBuyLamports < settings.liquidityTier1EndLamports
    ? initialBuyLamports
    : settings.liquidityTier1EndLamports;
  const tier1Amount = tier1End - settings.liquidityFreeThresholdLamports;

  const tier2End = initialBuyLamports < settings.liquidityTier2EndLamports
    ? initialBuyLamports
    : settings.liquidityTier2EndLamports;
  const tier2Amount = tier2End > settings.liquidityTier1EndLamports
    ? tier2End - settings.liquidityTier1EndLamports
    : 0n;

  const highAmount = initialBuyLamports > settings.liquidityTier2EndLamports
    ? initialBuyLamports - settings.liquidityTier2EndLamports
    : 0n;

  const rawFee =
    feeForRange(tier1Amount, settings.liquidityFeeBpsLow) +
    feeForRange(tier2Amount, settings.liquidityFeeBpsMid) +
    feeForRange(highAmount, settings.liquidityFeeBpsHigh);

  return rawFee > settings.liquidityFeeCapLamports
    ? settings.liquidityFeeCapLamports
    : rawFee;
}

export function buildLaunchpadFeeQuote(input: LaunchpadFeeQuoteInput): LaunchpadFeeQuote {
  validatePublicKey(input.wallet, "wallet");

  const settings = getLaunchpadFeeSettings();
  const initialBuyLamports = BigInt(input.initialBuyLamports ?? 0);
  const requestedExtraTipLamports = BigInt(input.extraTipLamports ?? 0);

  if (requestedExtraTipLamports > 0n && !settings.feesEnabled) {
    throw new Error("extraTipLamports is unavailable while launchpad fees are disabled");
  }

  const verified = input.verified === true;
  const baseFeeLamports = settings.feesEnabled ? settings.baseFeeLamports : 0n;
  const verifiedFeeLamports = settings.feesEnabled && verified ? settings.verifiedFeeLamports : 0n;
  const liquidityFeeLamports = settings.feesEnabled
    ? calculateLiquidityFeeLamports(initialBuyLamports, settings)
    : 0n;
  const totalPlatformFeeLamports = baseFeeLamports + verifiedFeeLamports + liquidityFeeLamports;
  const extraTipLamports = settings.feesEnabled ? requestedExtraTipLamports : 0n;
  const totalTipLamports = totalPlatformFeeLamports + extraTipLamports;
  const creatorFeeShareBps = settings.feesEnabled ? settings.creatorShareBps : 10000;
  const bagsShieldFeeShareBps = settings.feesEnabled ? settings.bagsShieldShareBps : 0;

  return {
    feesEnabled: settings.feesEnabled,
    feeMode: settings.feeMode,
    treasuryWallet: settings.treasuryWallet,
    baseFeeLamports: toSafeNumber(baseFeeLamports, "baseFeeLamports"),
    verifiedFeeLamports: toSafeNumber(verifiedFeeLamports, "verifiedFeeLamports"),
    liquidityFeeLamports: toSafeNumber(liquidityFeeLamports, "liquidityFeeLamports"),
    extraTipLamports: toSafeNumber(extraTipLamports, "extraTipLamports"),
    totalPlatformFeeLamports: toSafeNumber(totalPlatformFeeLamports, "totalPlatformFeeLamports"),
    totalTipLamports: toSafeNumber(totalTipLamports, "totalTipLamports"),
    creatorFeeShareBps,
    bagsShieldFeeShareBps,
    totalBps: creatorFeeShareBps + bagsShieldFeeShareBps,
    estimatedNetworkFeeLamports: null,
    estimatedRentLamports: null,
    disclaimer: "Network and rent costs are estimates. Platform fees are shown before signing.",
  };
}

export function buildLaunchpadFeeShare(payer: string): {
  claimersArray: string[];
  basisPointsArray: number[];
  feesEnabled: boolean;
  creatorFeeShareBps: number;
  bagsShieldFeeShareBps: number;
  totalBps: number;
  treasuryWallet: string;
} {
  const creatorWallet = validatePublicKey(payer, "payer");
  const settings = getLaunchpadFeeSettings();

  if (!settings.feesEnabled) {
    return {
      claimersArray: [creatorWallet],
      basisPointsArray: [10000],
      feesEnabled: false,
      creatorFeeShareBps: 10000,
      bagsShieldFeeShareBps: 0,
      totalBps: 10000,
      treasuryWallet: settings.treasuryWallet,
    };
  }

  return {
    claimersArray: [creatorWallet, settings.treasuryWallet],
    basisPointsArray: [settings.creatorShareBps, settings.bagsShieldShareBps],
    feesEnabled: true,
    creatorFeeShareBps: settings.creatorShareBps,
    bagsShieldFeeShareBps: settings.bagsShieldShareBps,
    totalBps: settings.creatorShareBps + settings.bagsShieldShareBps,
    treasuryWallet: settings.treasuryWallet,
  };
}
