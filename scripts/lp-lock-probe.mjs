/**
 * LP-lock pool detection probe.
 *
 * Mirrors src/lib/lp-lock/service.ts detectPoolForMint() so you can validate, from
 * the CLI, which source resolves a token's pool. Useful to diagnose why production
 * returns awaiting_pool (e.g. DexScreener blocked for serverless egress while the
 * Bags claimable-positions fallback works).
 *
 * Usage:
 *   node scripts/lp-lock-probe.mjs <mint> [wallet]
 *
 * Env (for the Bags fallback):
 *   BAGS_API_BASE  (default https://public-api-v2.bags.fm/api/v1)
 *   BAGS_API_KEY   (required for the Bags claimable-positions fallback)
 *
 * Example:
 *   node scripts/lp-lock-probe.mjs JCtVhGYh4Ur2Qt12naiBoabhFbWCMwHR5ZZje9QTBAGS ZMZG8NYM5ELH2spunNJBfB3MJCjeJVxS6SGdVVUdrGL
 *
 * Expected minimum: poolAddress = DcxhUv2AibjhiD88eysNMs6PxbuwKxSv9pZBkuwdcyre, status = pool_detected, verified = false
 */

const SUPPORTED_DEXES = ['orca', 'meteora', 'raydium', 'bags'];
const TREASURY = '7ZybPucnSryE5BydcARdc4Q2gz1SaospMVRyQ2LCeyRi'; // Bags Shield fee-claimer on every launch
const BAGS_BASE = (process.env.BAGS_API_BASE || 'https://public-api-v2.bags.fm/api/v1').replace(/\/+$/, '');
const BAGS_KEY = process.env.BAGS_API_KEY || '';

const mapDexIdToPoolType = (dexId) => (dexId === 'bags' ? 'meteora' : dexId);

async function viaDexScreener(mint) {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { cache: 'no-store' });
    if (!res.ok) return { source: 'dexscreener', pool: null, httpStatus: res.status };
    const data = await res.json();
    const pairs = data.pairs ?? [];
    const accepted = pairs
      .filter((p) => p.chainId === 'solana' && SUPPORTED_DEXES.includes(p.dexId) && p.pairAddress)
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const best = accepted[0];
    return {
      source: 'dexscreener',
      httpStatus: res.status,
      pairCount: pairs.length,
      dexIds: [...new Set(pairs.map((p) => p.dexId))],
      pool: best ? { poolAddress: best.pairAddress, poolType: mapDexIdToPoolType(best.dexId), liquidityUsd: best.liquidity?.usd ?? 0 } : null,
    };
  } catch (e) {
    return { source: 'dexscreener', pool: null, error: String(e?.message || e) };
  }
}

async function viaBagsClaimable(mint, wallets) {
  if (!BAGS_KEY) return { source: 'bags_claimable', pool: null, note: 'BAGS_API_KEY not set' };
  for (const wallet of wallets) {
    if (!wallet) continue;
    try {
      const res = await fetch(`${BAGS_BASE}/token-launch/claimable-positions?wallet=${wallet}`, {
        headers: { 'x-api-key': BAGS_KEY, accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const body = await res.json();
      const positions = Array.isArray(body?.response) ? body.response : Array.isArray(body) ? body : [];
      const match = positions.find((p) => (p.baseMint ?? p.tokenMint) === mint);
      const poolAddress = match ? (match.virtualPool ?? match.poolAddress) : undefined;
      if (poolAddress) {
        return { source: 'bags_claimable', walletTried: wallet, positionCount: positions.length, pool: { poolAddress, poolType: 'meteora', liquidityUsd: 0 } };
      }
    } catch {
      // try next wallet
    }
  }
  return { source: 'bags_claimable', pool: null };
}

(async () => {
  const mint = process.argv[2];
  const wallet = process.argv[3];
  if (!mint) {
    console.error('Usage: node scripts/lp-lock-probe.mjs <mint> [wallet]');
    process.exit(1);
  }
  const wallets = [...new Set([wallet, TREASURY].filter(Boolean))];

  const dex = await viaDexScreener(mint);
  console.log('A) DexScreener:', JSON.stringify(dex, null, 2));

  let pool = dex.pool;
  if (!pool) {
    const bags = await viaBagsClaimable(mint, wallets);
    console.log('B) Bags claimable:', JSON.stringify(bags, null, 2));
    pool = bags.pool;
  }

  const result = pool
    ? { status: 'pool_detected', pool, lockProvider: 'meteora_dbc', lockMode: 'native_protocol', verified: false }
    : { status: 'awaiting_pool', pool: null, verified: false };

  console.log('\n==> RESULT:', JSON.stringify(result, null, 2));
  process.exit(pool ? 0 : 2);
})();
