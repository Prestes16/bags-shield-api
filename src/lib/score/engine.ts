/**
 * Score engine: combine signals, apply rules, compute score and confidence.
 */

import type { ScoreSignals } from './signals';
import { computeScore } from './rules';
import { explainReasons } from './explain';

export interface EngineResult {
  score: number;
  badge: 'SAFE' | 'CAUTION' | 'HIGH_RISK';
  confidence: number;
  reasons: Array<{
    code: string;
    title: string;
    detail: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    evidence: Record<string, unknown>;
  }>;
  signals: ScoreSignals;
}

/**
 * Confidence in [0, 1]. Decreases when sources are missing or data conflict.
 */
export function computeConfidence(signals: ScoreSignals): number {
  let c = 1;
  if (signals.sourcesTotal > 0) {
    c *= signals.sourcesOk / signals.sourcesTotal;
  }
  if (signals.dataConflict) c *= 0.7;
  if (signals.mintActive === null && signals.sourcesOk > 0) c *= 0.9;
  return Math.round(c * 100) / 100;
}

export function runEngine(signals: ScoreSignals): EngineResult {
  const { score, badge } = computeScore(signals);
  const confidence = computeConfidence(signals);
  const reasons = explainReasons(signals, score);

  return {
    score,
    badge,
    confidence,
    reasons,
    signals,
  };
}
