import { PublicKey } from "@solana/web3.js";
import {
  BAGS_SHIELD_FEE_SHARE_WALLET,
  getLaunchpadFeeSettings,
} from "@/lib/launchpad/fees";

export interface LaunchpadFeeSharePlanInput {
  creatorWallet: string;
}

export interface LaunchpadFeeSharePlan {
  feesEnabled: boolean;
  totalBps: number;
  creatorWallet: string;
  creatorBps: number;
  bagsShieldWallet: string | null;
  bagsShieldBps: number;
  claimersArray: string[];
  basisPointsArray: number[];
}

export interface FeeSharePlanCheck {
  id: string;
  ok: boolean;
  message: string;
}

function normalizePublicKey(value: string, field: string) {
  try {
    return new PublicKey(value).toBase58();
  } catch {
    throw new Error(`${field} must be a valid Solana public key`);
  }
}

function addBps(map: Map<string, number>, wallet: string, bps: number) {
  if (!Number.isSafeInteger(bps) || bps < 0) {
    throw new Error("Fee-share BPS must be non-negative safe integers");
  }
  map.set(wallet, (map.get(wallet) || 0) + bps);
}

export function buildLaunchpadFeeSharePlan(input: LaunchpadFeeSharePlanInput): LaunchpadFeeSharePlan {
  const settings = getLaunchpadFeeSettings();
  const creatorWallet = normalizePublicKey(input.creatorWallet, "creatorWallet");
  const officialBagsShieldWallet = normalizePublicKey(
    BAGS_SHIELD_FEE_SHARE_WALLET,
    "BAGS_SHIELD_FEE_SHARE_WALLET",
  );
  const bagsShieldWallet = settings.feesEnabled
    ? normalizePublicKey(settings.treasuryWallet, "LAUNCHPAD_TREASURY_WALLET")
    : null;

  if (settings.feesEnabled && bagsShieldWallet !== officialBagsShieldWallet) {
    throw new Error("LAUNCHPAD_FEE_SHARE_WALLET_NOT_CONFIGURED");
  }

  const bpsByWallet = new Map<string, number>();
  if (settings.feesEnabled) {
    addBps(bpsByWallet, creatorWallet, settings.creatorShareBps);
    addBps(bpsByWallet, bagsShieldWallet as string, settings.bagsShieldShareBps);
  } else {
    addBps(bpsByWallet, creatorWallet, 10000);
  }

  const claimersArray = [...bpsByWallet.keys()];
  const basisPointsArray = claimersArray.map((wallet) => bpsByWallet.get(wallet) || 0);
  const creatorBps = bpsByWallet.get(creatorWallet) || 0;
  const bagsShieldBps = bagsShieldWallet ? bpsByWallet.get(bagsShieldWallet) || 0 : 0;
  const totalBps = basisPointsArray.reduce((total, value) => total + value, 0);

  const plan: LaunchpadFeeSharePlan = {
    feesEnabled: settings.feesEnabled,
    totalBps,
    creatorWallet,
    creatorBps,
    bagsShieldWallet,
    bagsShieldBps,
    claimersArray,
    basisPointsArray,
  };

  const failedCheck = validateFeeSharePlan(plan).find((check) => !check.ok);
  if (failedCheck) {
    throw new Error(failedCheck.message);
  }

  return plan;
}

export function validateFeeSharePlan(plan: LaunchpadFeeSharePlan): FeeSharePlanCheck[] {
  const hasSameLength = plan.claimersArray.length === plan.basisPointsArray.length;
  const noEmptyWallets = plan.claimersArray.every(Boolean);
  const noNegativeBps = plan.basisPointsArray.every((bps) => Number.isSafeInteger(bps) && bps >= 0);
  const creatorExplicit = plan.claimersArray.includes(plan.creatorWallet) && plan.creatorBps > 0;
  const bagsShieldExplicit = !plan.feesEnabled || (
    Boolean(plan.bagsShieldWallet) &&
    plan.claimersArray.includes(plan.bagsShieldWallet as string) &&
    plan.bagsShieldBps > 0
  );

  return [
    {
      id: "bps_lengths",
      ok: hasSameLength,
      message: hasSameLength
        ? "claimersArray and basisPointsArray have matching length"
        : "claimersArray and basisPointsArray must have matching length",
    },
    {
      id: "wallets_present",
      ok: noEmptyWallets,
      message: noEmptyWallets ? "All fee-share wallets are present" : "Fee-share wallets cannot be empty",
    },
    {
      id: "bps_non_negative",
      ok: noNegativeBps,
      message: noNegativeBps ? "All BPS values are non-negative" : "BPS values cannot be negative",
    },
    {
      id: "bps_total",
      ok: plan.totalBps === 10000,
      message: plan.totalBps === 10000 ? "BPS total is 10000" : "BPS total must be exactly 10000",
    },
    {
      id: "creator_explicit",
      ok: creatorExplicit,
      message: creatorExplicit ? "Creator BPS is explicit" : "Creator wallet must be explicit in fee-share",
    },
    {
      id: "bags_shield_fee_share",
      ok: bagsShieldExplicit,
      message: bagsShieldExplicit
        ? "Bags Shield fee share is explicit"
        : "Bags Shield fee-share wallet must be explicit when app fee-share is enabled",
    },
  ];
}
