/**
 * Pure scoring rules: penalties and bonuses. No I/O.
 * Input: ScoreSignals. Output: delta (positive = bonus, negative = penalty).
 */

import type { ScoreSignals } from './signals';

const SCORE_MAX = 100;
const SCORE_MIN = 0;

/** SAFE >= 80, CAUTION 50-79, HIGH_RISK < 50 */
export function scoreToBadge(score: number): 'SAFE' | 'CAUTION' | 'HIGH_RISK' {
  if (score >= 80) return 'SAFE';
  if (score >= 50) return 'CAUTION';
  return 'HIGH_RISK';
}

/** Clamp score to [0, 100] */
export function clampScore(score: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(score)));
}

/**
 * Base score when we have at least one source. Reduced when sources are missing.
 */
export function baseScoreFromSources(sourcesOk: number, sourcesTotal: number): number {
  if (sourcesTotal === 0) return 50;
  const ratio = sourcesOk / sourcesTotal;
  if (ratio >= 1) return 70;
  if (ratio >= 0.5) return 60;
  return 50;
}

/**
 * Penalty when mint is not active (frozen or missing).
 */
export function penaltyMintInactive(signals: ScoreSignals): number {
  if (signals.mintActive === null) return 0;
  return signals.mintActive ? 0 : -25;
}

/**
 * Bonus for LP lock (longer = better, up to a cap).
 */
export function bonusLpLock(signals: ScoreSignals): number {
  const sec = signals.lpLockSeconds;
  if (sec === null || sec <= 0) return 0;
  if (sec >= 365 * 24 * 3600) return 15;
  if (sec >= 90 * 24 * 3600) return 10;
  if (sec >= 30 * 24 * 3600) return 5;
  return 2;
}

/**
 * Penalty for high top-10 concentration (rug risk).
 */
export function penaltyTop10Concentration(signals: ScoreSignals): number {
  const pct = signals.top10ConcentrationPercent;
  if (pct === null) return 0;
  if (pct >= 90) return -30;
  if (pct >= 70) return -20;
  if (pct >= 50) return -10;
  return 0;
}

/**
 * Penalty for sell tax (can trap users).
 */
export function penaltySellTax(signals: ScoreSignals): number {
  const bps = signals.sellTaxBps;
  if (bps === null || bps <= 0) return 0;
  if (bps >= 1000) return -20;
  if (bps >= 500) return -10;
  if (bps >= 100) return -5;
  return 0;
}

/**
 * Penalty when data conflict is detected (price/volume divergence).
 */
export function penaltyDataConflict(signals: ScoreSignals): number {
  return signals.dataConflict ? -15 : 0;
}

/**
 * Penalty for low liquidity.
 */
export function penaltyLowLiquidity(signals: ScoreSignals): number {
  const liq = signals.market.liquidityUsd;
  if (liq === null) return 0;
  if (liq < 1_000) return -20;
  if (liq < 10_000) return -10;
  if (liq < 50_000) return -5;
  return 0;
}

/**
 * Penalty for bot/wash trading signals.
 */
export function penaltyActors(signals: ScoreSignals): number {
  let p = 0;
  if (signals.actors.botLikely) p -= 10;
  if (signals.actors.washLikely) p -= 15;
  return p;
}

/**
 * Sum all rule deltas and return final score (clamped) and badge.
 */
export function computeScore(signals: ScoreSignals): { score: number; badge: 'SAFE' | 'CAUTION' | 'HIGH_RISK' } {
  const base = baseScoreFromSources(signals.sourcesOk, signals.sourcesTotal);
  const total =
    base +
    penaltyMintInactive(signals) +
    bonusLpLock(signals) +
    penaltyTop10Concentration(signals) +
    penaltySellTax(signals) +
    penaltyDataConflict(signals) +
    penaltyLowLiquidity(signals) +
    penaltyActors(signals);
  const score = clampScore(total);
  const badge = scoreToBadge(score);
  return { score, badge };
}
