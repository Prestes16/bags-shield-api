/**
 * Generate human-readable reasons from signals and rule outcomes.
 */

import type { ScoreSignals } from './signals';
import {
  penaltyMintInactive,
  bonusLpLock,
  penaltyTop10Concentration,
  penaltySellTax,
  penaltyDataConflict,
  penaltyLowLiquidity,
  penaltyActors,
  scoreToBadge,
} from './rules';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Reason {
  code: string;
  title: string;
  detail: string;
  severity: Severity;
  evidence: Record<string, unknown>;
}

export function explainReasons(signals: ScoreSignals, score: number): Reason[] {
  const reasons: Reason[] = [];
  const badge = scoreToBadge(score);

  if (signals.mintActive === false) {
    reasons.push({
      code: 'MINT_NOT_ACTIVE',
      title: 'Mint not active',
      detail: 'Token mint is frozen or not active on-chain.',
      severity: 'HIGH',
      evidence: {},
    });
  }

  const lpBonus = bonusLpLock(signals);
  if (lpBonus > 0 && signals.lpLockSeconds != null) {
    reasons.push({
      code: 'LP_LOCKED',
      title: 'Liquidity locked',
      detail: `Liquidity is locked for a period (${Math.round(signals.lpLockSeconds / 86400)} days).`,
      severity: 'LOW',
      evidence: { lpLockSeconds: signals.lpLockSeconds },
    });
  }

  const top10Pen = penaltyTop10Concentration(signals);
  if (top10Pen < 0 && signals.top10ConcentrationPercent != null) {
    reasons.push({
      code: 'HIGH_CONCENTRATION',
      title: 'High holder concentration',
      detail: `Top 10 holders control ${signals.top10ConcentrationPercent}% of supply.`,
      severity: signals.top10ConcentrationPercent >= 80 ? 'HIGH' : 'MEDIUM',
      evidence: { top10ConcentrationPercent: signals.top10ConcentrationPercent },
    });
  }

  const sellTaxPen = penaltySellTax(signals);
  if (sellTaxPen < 0 && signals.sellTaxBps != null) {
    reasons.push({
      code: 'SELL_TAX',
      title: 'Sell tax',
      detail: `Token has sell tax (${signals.sellTaxBps} bps).`,
      severity: signals.sellTaxBps >= 500 ? 'HIGH' : 'MEDIUM',
      evidence: { sellTaxBps: signals.sellTaxBps },
    });
  }

  if (signals.dataConflict) {
    reasons.push({
      code: 'DATA_CONFLICT',
      title: 'Data conflict',
      detail: 'Price or volume differs significantly between sources.',
      severity: 'MEDIUM',
      evidence: {},
    });
  }

  const liqPen = penaltyLowLiquidity(signals);
  if (liqPen < 0 && signals.market.liquidityUsd != null) {
    reasons.push({
      code: 'LOW_LIQUIDITY',
      title: 'Low liquidity',
      detail: `Liquidity is $${signals.market.liquidityUsd.toLocaleString()}.`,
      severity: (signals.market.liquidityUsd ?? 0) < 1_000 ? 'HIGH' : 'MEDIUM',
      evidence: { liquidityUsd: signals.market.liquidityUsd },
    });
  }

  if (signals.actors.botLikely) {
    reasons.push({
      code: 'BOT_LIKELY',
      title: 'Bot activity',
      detail: 'Trading patterns suggest bot activity.',
      severity: 'MEDIUM',
      evidence: {},
    });
  }
  if (signals.actors.washLikely) {
    reasons.push({
      code: 'WASH_LIKELY',
      title: 'Wash trading',
      detail: 'Trading patterns suggest wash trading.',
      severity: 'HIGH',
      evidence: {},
    });
  }

  if (signals.sourcesOk < signals.sourcesTotal && signals.sourcesTotal > 0) {
    reasons.push({
      code: 'DEGRADED_SOURCES',
      title: 'Incomplete data',
      detail: `${signals.sourcesOk}/${signals.sourcesTotal} data sources available.`,
      severity: 'LOW',
      evidence: { sourcesOk: signals.sourcesOk, sourcesTotal: signals.sourcesTotal },
    });
  }

  return reasons;
}
