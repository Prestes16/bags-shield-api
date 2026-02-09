/**
 * Unit tests for score rules
 */

import {
  scoreToBadge,
  clampScore,
  baseScoreFromSources,
  penaltyMintInactive,
  bonusLpLock,
  penaltyTop10Concentration,
  penaltySellTax,
  penaltyDataConflict,
  penaltyLowLiquidity,
  penaltyActors,
  computeScore,
} from '../rules';
import type { ScoreSignals } from '../signals';
import { DEFAULT_SIGNALS } from '../signals';

function signals(overrides: Partial<ScoreSignals> = {}): ScoreSignals {
  return {
    ...DEFAULT_SIGNALS,
    market: { ...DEFAULT_SIGNALS.market },
    pools: [],
    actors: { ...DEFAULT_SIGNALS.actors },
    evidence: {},
    sourcesOk: 4,
    sourcesTotal: 4,
    ...overrides,
  };
}

describe('score rules', () => {
  describe('scoreToBadge', () => {
    it('SAFE >= 80', () => {
      expect(scoreToBadge(80)).toBe('SAFE');
      expect(scoreToBadge(100)).toBe('SAFE');
    });
    it('CAUTION 50-79', () => {
      expect(scoreToBadge(50)).toBe('CAUTION');
      expect(scoreToBadge(79)).toBe('CAUTION');
    });
    it('HIGH_RISK < 50', () => {
      expect(scoreToBadge(49)).toBe('HIGH_RISK');
      expect(scoreToBadge(0)).toBe('HIGH_RISK');
    });
  });

  describe('clampScore', () => {
    it('clamps to [0, 100]', () => {
      expect(clampScore(-10)).toBe(0);
      expect(clampScore(150)).toBe(100);
      expect(clampScore(50)).toBe(50);
    });
    it('rounds', () => {
      expect(clampScore(50.4)).toBe(50);
      expect(clampScore(50.6)).toBe(51);
    });
  });

  describe('baseScoreFromSources', () => {
    it('returns 70 when all ok', () => {
      expect(baseScoreFromSources(4, 4)).toBe(70);
    });
    it('returns 60 when half ok', () => {
      expect(baseScoreFromSources(2, 4)).toBe(60);
    });
    it('returns 50 when few or none', () => {
      expect(baseScoreFromSources(1, 4)).toBe(50);
      expect(baseScoreFromSources(0, 4)).toBe(50);
      expect(baseScoreFromSources(0, 0)).toBe(50);
    });
  });

  describe('penaltyMintInactive', () => {
    it('no penalty when null or true', () => {
      expect(penaltyMintInactive(signals({ mintActive: null }))).toBe(0);
      expect(penaltyMintInactive(signals({ mintActive: true }))).toBe(0);
    });
    it('penalty when false', () => {
      expect(penaltyMintInactive(signals({ mintActive: false }))).toBe(-25);
    });
  });

  describe('bonusLpLock', () => {
    it('no bonus when null or 0', () => {
      expect(bonusLpLock(signals({ lpLockSeconds: null }))).toBe(0);
      expect(bonusLpLock(signals({ lpLockSeconds: 0 }))).toBe(0);
    });
    it('bonus scales with lock duration', () => {
      expect(bonusLpLock(signals({ lpLockSeconds: 30 * 24 * 3600 }))).toBe(5);
      expect(bonusLpLock(signals({ lpLockSeconds: 365 * 24 * 3600 }))).toBe(15);
    });
  });

  describe('penaltyTop10Concentration', () => {
    it('no penalty when null or low', () => {
      expect(penaltyTop10Concentration(signals({ top10ConcentrationPercent: null }))).toBe(0);
      expect(penaltyTop10Concentration(signals({ top10ConcentrationPercent: 40 }))).toBe(0);
    });
    it('penalty when high', () => {
      expect(penaltyTop10Concentration(signals({ top10ConcentrationPercent: 55 }))).toBe(-10);
      expect(penaltyTop10Concentration(signals({ top10ConcentrationPercent: 75 }))).toBe(-20);
      expect(penaltyTop10Concentration(signals({ top10ConcentrationPercent: 95 }))).toBe(-30);
    });
  });

  describe('penaltySellTax', () => {
    it('no penalty when null or 0', () => {
      expect(penaltySellTax(signals({ sellTaxBps: null }))).toBe(0);
      expect(penaltySellTax(signals({ sellTaxBps: 0 }))).toBe(0);
    });
    it('penalty when present', () => {
      expect(penaltySellTax(signals({ sellTaxBps: 150 }))).toBe(-5);
      expect(penaltySellTax(signals({ sellTaxBps: 600 }))).toBe(-10);
      expect(penaltySellTax(signals({ sellTaxBps: 1500 }))).toBe(-20);
    });
  });

  describe('penaltyDataConflict', () => {
    it('no penalty when false', () => {
      expect(penaltyDataConflict(signals({ dataConflict: false }))).toBe(0);
    });
    it('penalty when true', () => {
      expect(penaltyDataConflict(signals({ dataConflict: true }))).toBe(-15);
    });
  });

  describe('penaltyLowLiquidity', () => {
    it('no penalty when null or high', () => {
      expect(penaltyLowLiquidity(signals())).toBe(0);
      const s = signals();
      s.market.liquidityUsd = 100_000;
      expect(penaltyLowLiquidity(s)).toBe(0);
    });
    it('penalty when low', () => {
      const s = signals();
      s.market.liquidityUsd = 500;
      expect(penaltyLowLiquidity(s)).toBe(-20);
      s.market.liquidityUsd = 5_000;
      expect(penaltyLowLiquidity(s)).toBe(-10);
    });
  });

  describe('penaltyActors', () => {
    it('no penalty when clean', () => {
      expect(penaltyActors(signals())).toBe(0);
    });
    it('penalty for bot and wash', () => {
      expect(penaltyActors(signals({ actors: { botLikely: true, washLikely: false, notes: [] } }))).toBe(-10);
      expect(penaltyActors(signals({ actors: { botLikely: false, washLikely: true, notes: [] } }))).toBe(-15);
      expect(penaltyActors(signals({ actors: { botLikely: true, washLikely: true, notes: [] } }))).toBe(-25);
    });
  });

  describe('computeScore', () => {
    it('all sources ok, no penalties → SAFE', () => {
      const s = signals({ sourcesOk: 4, sourcesTotal: 4, mintActive: true });
      const { score, badge } = computeScore(s);
      expect(score).toBeGreaterThanOrEqual(80);
      expect(badge).toBe('SAFE');
    });
    it('mint inactive + low sources → lower score', () => {
      const s = signals({ sourcesOk: 1, sourcesTotal: 4, mintActive: false });
      const { score, badge } = computeScore(s);
      expect(score).toBeLessThan(80);
      expect(badge).toBe('CAUTION');
    });
    it('data conflict + wash → HIGH_RISK', () => {
      const s = signals({
        sourcesOk: 2,
        sourcesTotal: 4,
        dataConflict: true,
        actors: { botLikely: false, washLikely: true, notes: [] },
      });
      const { score, badge } = computeScore(s);
      expect(score).toBeLessThan(50);
      expect(badge).toBe('HIGH_RISK');
    });
  });
});
