/**
 * Economy v0: Decisão de fees e tracking para Jupiter Swap
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export type ShieldGrade = 'A' | 'B' | 'C' | 'D' | 'E';
export type Tier = 'free' | 'pro';

export interface EconomyV0Config {
  version: 'v0';
  integrator: {
    name: string;
    defaultSwapMode: 'ExactIn';
    trackingAccount: string;
    feeAccountsByMint: Record<string, string>;
  };
  fees: {
    bps: { default: number; premiumMax: number; optOut: number };
    caps: { maxBps: number };
  };
  cashback: any;
  tiers: Record<Tier, { feeBpsMultiplier: number; cashbackMultiplier: number }>;
  revenueSplit: any;
}

export interface FeeDecision {
  feeBps: number;
  trackingAccount: string;
  feeAccount?: string;
  reasons: string[];
}

let cachedConfig: EconomyV0Config | null = null;

function loadConfig(): EconomyV0Config {
  if (cachedConfig) return cachedConfig;

  try {
    const configPath = join(process.cwd(), 'config', 'economy.v0.json');
    const content = readFileSync(configPath, 'utf-8');
    cachedConfig = JSON.parse(content) as EconomyV0Config;
    return cachedConfig!;
  } catch (err) {
    console.error('[economy] Failed to load config:', err);
    // Fallback seguro
    return {
      version: 'v0',
      integrator: {
        name: 'Bags Shield',
        defaultSwapMode: 'ExactIn',
        trackingAccount: '',
        feeAccountsByMint: {},
      },
      fees: {
        bps: { default: 0, premiumMax: 0, optOut: 0 },
        caps: { maxBps: 0 },
      },
      cashback: {},
      tiers: {
        free: { feeBpsMultiplier: 1.0, cashbackMultiplier: 1.0 },
        pro: { feeBpsMultiplier: 0.8, cashbackMultiplier: 1.25 },
      },
      revenueSplit: {},
    };
  }
}

export function decideFee(
  cfg: EconomyV0Config,
  opts: {
    userOptOut: boolean;
    tier: Tier;
    wantsPremium: boolean;
    outputMint: string; // vamos coletar no outputMint (ExactIn)
  },
): FeeDecision {
  const reasons: string[] = [];

  if (opts.userOptOut) {
    reasons.push('optOut');
    return {
      feeBps: cfg.fees.bps.optOut,
      trackingAccount: cfg.integrator.trackingAccount,
      reasons,
    };
  }

  const base = opts.wantsPremium ? cfg.fees.bps.premiumMax : cfg.fees.bps.default;
  reasons.push(opts.wantsPremium ? 'premium' : 'default');

  const mult = cfg.tiers[opts.tier]?.feeBpsMultiplier ?? 1;
  reasons.push(`tier:${opts.tier}`);

  const feeBps = Math.min(Math.round(base * mult), cfg.fees.caps.maxBps);

  const feeAccount = cfg.integrator.feeAccountsByMint[opts.outputMint];
  if (!feeAccount) reasons.push('noFeeAccountForOutputMint');

  return {
    feeBps,
    feeAccount,
    trackingAccount: cfg.integrator.trackingAccount,
    reasons,
  };
}

/**
 * Helper para obter decisão de fee com config carregada automaticamente
 */
export function getFeeDecision(opts: {
  userOptOut?: boolean;
  tier?: Tier;
  wantsPremium?: boolean;
  outputMint: string;
}): FeeDecision {
  const cfg = loadConfig();
  return decideFee(cfg, {
    userOptOut: opts.userOptOut ?? false,
    tier: opts.tier ?? 'free',
    wantsPremium: opts.wantsPremium ?? false,
    outputMint: opts.outputMint,
  });
}
