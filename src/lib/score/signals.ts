/**
 * Normalized signals collected from providers for the score engine.
 * All inputs are treated as untrusted; sanity checks in rules.
 */

export type Badge = 'SAFE' | 'CAUTION' | 'HIGH_RISK';

export interface MarketSignals {
  priceUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  sourcesUsed: string[];
}

export interface PoolSignals {
  type: 'meteora' | 'raydium' | 'unknown';
  address: string;
  liquidity: number;
  lpLocked: boolean | null;
  evidence: Record<string, unknown>;
}

export interface ActorsSignals {
  botLikely: boolean;
  washLikely: boolean;
  notes: string[];
}

export interface ScoreSignals {
  /** Mint is active (on-chain, not frozen) */
  mintActive: boolean | null;
  /** LP lock duration (seconds) if known */
  lpLockSeconds: number | null;
  /** Top-10 holder concentration (0-100) */
  top10ConcentrationPercent: number | null;
  /** Sell tax (basis points) if any */
  sellTaxBps: number | null;
  /** Number of sources that returned data */
  sourcesOk: number;
  /** Total sources attempted */
  sourcesTotal: number;
  /** Data conflict between sources (e.g. price/volume divergence) */
  dataConflict: boolean;
  market: MarketSignals;
  pools: PoolSignals[];
  actors: ActorsSignals;
  /** Raw evidence for reasons (e.g. helius result, birdeye) */
  evidence: Record<string, unknown>;
}

export const DEFAULT_SIGNALS: ScoreSignals = {
  mintActive: null,
  lpLockSeconds: null,
  top10ConcentrationPercent: null,
  sellTaxBps: null,
  sourcesOk: 0,
  sourcesTotal: 0,
  dataConflict: false,
  market: {
    priceUsd: null,
    liquidityUsd: null,
    volume24hUsd: null,
    sourcesUsed: [],
  },
  pools: [],
  actors: { botLikely: false, washLikely: false, notes: [] },
  evidence: {},
};
