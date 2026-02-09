/**
 * Unit tests for score engine
 */

import { runEngine, computeConfidence } from '../engine';
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

describe('score engine', () => {
  it('returns score, badge, confidence, reasons', () => {
    const s = signals();
    const result = runEngine(s);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(['SAFE', 'CAUTION', 'HIGH_RISK']).toContain(result.badge);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(result.signals).toBe(s);
  });

  it('confidence decreases with fewer sources', () => {
    const full = signals({ sourcesOk: 4, sourcesTotal: 4 });
    const half = signals({ sourcesOk: 2, sourcesTotal: 4 });
    expect(computeConfidence(full)).toBeGreaterThanOrEqual(computeConfidence(half));
  });

  it('confidence decreases with data conflict', () => {
    const noConflict = signals({ dataConflict: false });
    const withConflict = signals({ dataConflict: true });
    expect(computeConfidence(noConflict)).toBeGreaterThan(computeConfidence(withConflict));
  });

  it('reasons include DEGRADED_SOURCES when sources missing', () => {
    const s = signals({ sourcesOk: 2, sourcesTotal: 4 });
    const result = runEngine(s);
    const degraded = result.reasons.find((r) => r.code === 'DEGRADED_SOURCES');
    expect(degraded).toBeDefined();
  });
});
