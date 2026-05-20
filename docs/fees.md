# Fees & Cost Splits - Bags Shield

**Status:** beta documentation
**Last reviewed:** 2026-05-20

Fees must be explicit before the user signs. Do not mix Swap fees with Launchpad fees.

## Revenue Categories

| Category | Status | Notes |
|---|---|---|
| SWAP_FEE | Implemented, needs real audit | Jupiter/swap fee path is separate. Do not change or describe it as Launchpad revenue. |
| LAUNCHPAD_SERVICE_FEE | Partial / beta | Fee quote and tip flow exist. Mark verified only when visible in a real signed transaction. |
| BAGS_FEE_SHARE | Partial / beta | Fee-share config exists. Mark verified only with Bags response/config and later on-chain evidence. |
| VERIFIED_UPSELL | Partial / beta | Must be included in the real fee quote/transaction before being described as charged. |
| NETWORK_COST / RENT_COST | Estimate unless simulated | Must be labeled as estimate if not returned by RPC/simulation. |
| UI_ONLY | Not acceptable as fee claim | Remove or label clearly as estimate/roadmap. |

## Launchpad Beta Defaults

Current intended beta model:

- Base fee: `0.020 SOL`
- Verified fee: `0.030 SOL` when enabled/selected
- Liquidity proportional fee: marginal tier calculation in lamports, capped in beta
- Treasury wallet: documented server-side via `LAUNCHPAD_TREASURY_WALLET`
- Fee-share target: creator 9500 bps / Bags Shield 500 bps when enabled

## Security Rules

- No hidden fees.
- No fee claim without transaction/config evidence.
- Backend never signs user transactions.
- Frontend wallet signs user transactions.
- Server-side keys and private keys must never appear in frontend.

## Roadmap / Future

Multisig treasury splits, ops/payroll/community vaults, periodic reporting and governance are future operational design items unless implemented and approved.
