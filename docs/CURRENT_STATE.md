# Bags Shield - Current State

**Last reviewed:** 2026-05-20  
**Scope:** local repository review across `bags-shield-api` and `bags-shield-app2`  
**Editorial rule:** proof, not promises.

This document is the local source of truth for the current product state. It separates implemented functionality from beta, partial, mocked, planned and future work.

## Status Legend

| Status | Meaning |
|---|---|
| Validated locally | Local command, route, component or config was inspected and/or command passed in this review. |
| Implemented, needs real test | Code path exists, but it needs a real wallet, production payload, upstream response or on-chain evidence. |
| Partial / beta | Usable or scaffolded, but not complete enough for a strong public claim. |
| Mock / stub | Data or behavior may be simulated, placeholder, controlled by env, or not production-grade. |
| Roadmap | Planned next work. |
| Future vision | Strategic direction, not committed implementation. |

## Validation Snapshot

Commands run during this review:

```powershell
cd C:\Dev\bags-shield-api
npm run typecheck
npm run smoke
npm run test:launchpad
npm run build

cd C:\Dev\bags-shield-app2\frontend
$env:CI='false'; npx craco build
```

Observed results:

| Check | Result | Notes |
|---|---|---|
| Backend `npm run typecheck` | Passed | TypeScript typecheck completed. |
| Backend `npm run smoke` | Passed | Local AJV smoke for `/api/v0/scan` and `/api/v0/simulate` passed. These are v0 smoke routes, not full production coverage. |
| Backend `npm run test:launchpad` | Passed with caveat | Wrapper reports 3/3. Schema and SSRF sections state that full tests require a configured test runner; manifest hash assertions ran. |
| Backend `npm run build` | Inconclusive | `next build` started but timed out after 240s without a compile error. Do not claim backend production build is verified from this run. |
| Frontend `npx craco build` | Passed | Optimized production build completed. |

## API Route Inventory

Current local route handler count:

- `src/app/api/**/route.ts`: **37 route handlers**.

Do not use the older absolute claims "14/14 routes" or "32 routes ready" without context. Those were historical or grouped counts, not the current raw route-handler count.

Main route families observed:

| Family | Examples | Status |
|---|---|---|
| Health/status | `/api/health`, `/api/status`, `/_whoami` | Implemented, needs production verification when documenting prod state. |
| Scan/simulate | `/api/scan`, `/api/simulate` | Implemented; v0 smoke passed. Full mainnet/provider coverage remains partial. |
| Swap/Jupiter | `/api/quote`, `/api/order`, `/api/execute`, `/api/swap` | Implemented, needs real wallet mainnet validation before "production ready" claim. |
| Wallet | `/api/wallet/tokens` | Implemented, needs wallet coverage validation. |
| Auth | `/api/auth/google`, `/api/auth/twitter`, `/api/auth/wallet`, callbacks, logout/me/link-wallet | Implemented, needs current OAuth production callback validation. |
| Launchpad | `/api/launchpad/*` | Implemented in beta form; requires controlled real Bags validation. |
| LP lock | `/api/launchpad/lp-lock` | Monitor/verify only; Bags Shield does not execute LP lock. |
| Fee claims | `/api/launchpad/fee-claims/*` | Implemented, needs wallet with real claimable position. |
| RPC/webhooks | `/api/rpc`, `/api/rpc/health`, `/api/webhooks/helius` | Implemented, env/upstream dependent. |

## Product Areas

### Scan Multi-Source

**Status:** Partial / beta.

Evidence:

- `src/app/api/scan/route.ts`
- `src/lib/score/engine.ts`
- `src/lib/score/rules.ts`
- `src/lib/score/collectSignals.ts`
- `src/lib/providers/helius.ts`
- `src/lib/providers/birdeye.ts`
- `src/lib/providers/dexscreener.ts`
- `src/lib/providers/meteora.ts`
- `src/lib/providers/orca.ts`

Current narrative:

> Bags Shield uses multiple sources and local heuristics to produce a ShieldScore with source coverage. The exact number of indicators must be documented in an auditable matrix before using numeric claims like "50+".

Do not claim:

- anti-scam guarantee;
- "50+ indicators" unless the matrix is attached;
- "unique in Solana" without external benchmark.

### ShieldScore and Coverage

**Status:** Implemented, needs broader validation.

The score is server-side and should be presented with coverage/confidence. A low-coverage result is not equivalent to a verified safe token.

Recommended language:

> ShieldScore is a risk signal, not a guarantee. Coverage shows which data sources were available for the result.

### Safe Swap / Pre-Trade Risk Check

**Status:** Implemented, needs real wallet mainnet validation.

Evidence:

- `src/app/api/quote/route.ts`
- `src/app/api/order/route.ts`
- `src/app/api/execute/route.ts`
- `src/app/api/swap/route.ts`
- frontend swap components/hooks in `bags-shield-app2`.

Blocker:

- A controlled mainnet test with a real wallet and small amount is still required before claiming end-to-end production readiness.

### Launchpad Bags v2

**Status:** Partial / beta.

Evidence:

- `src/app/api/launchpad/token-info/route.ts`
- `src/app/api/launchpad/create-config/route.ts`
- `src/app/api/launchpad/create-launch-transaction/route.ts`
- `src/app/api/launchpad/fee-quote/route.ts`
- `src/app/api/launchpad/send/route.ts`
- `src/lib/launchpad/bags-client.ts`
- `frontend/src/pages/LaunchpadPage.jsx`
- `frontend/src/lib/hooks/useApi.js`

Current narrative:

> Launchpad is wired to the Bags v2 flow in beta form. It creates metadata/token info, fee config, unsigned launch transaction and asks the user wallet to sign. It must not be described as fully production-proven until tested with real Bags responses and controlled launch flow.

### LP Lock

**Status:** Partial / beta verification. Not a lock executor.

Correct narrative:

> Bags Shield does not execute LP lock. It records intent, detects pools and verifies native protocol lock when there is on-chain or protocol evidence, especially via Meteora DBC.

Evidence:

- `src/app/api/launchpad/lp-lock/route.ts`
- `src/lib/lp-lock/service.ts`
- `src/lib/lp-lock/meteora-dbc.ts`
- `frontend/src/components/ui/lp-lock-status.jsx`

State rules:

| State | User-facing interpretation |
|---|---|
| `verified: true` from explicit on-chain/protocol evidence | Verified lock evidence. |
| `pool_detected` | Pool exists; lock is not proven. |
| `awaiting_pool` | Waiting for pool detection. |
| `unknown` | Unknown; do not imply safety. |
| `unverified` / `verified: false` | Not verified. |
| `monitor_only` | Monitor/read-only mode; no custody and no lock execution by Bags Shield. |

### Fee Claims / Revenue

**Status:** Implemented, needs real claimable-position test.

Evidence:

- `src/app/api/launchpad/fee-claims/positions/route.ts`
- `src/app/api/launchpad/fee-claims/transactions/route.ts`
- `src/lib/launchpad/bags-client.ts`
- `frontend/src/pages/PortfolioPage.jsx`

Security rule:

> Claims must be unsigned transactions from the backend/Bags flow, signed by the user wallet in the frontend. Bags Shield backend must not sign with the user's key.

### Portfolio

**Status:** Partial / beta.

Portfolio has UI and some integrations, including fee claim surfaces. Any placeholder, mock, or unavailable data must be documented as partial and not marketed as complete P&L.

### Auth / OAuth

**Status:** Implemented, needs current production callback validation.

Evidence:

- `src/app/api/auth/*`
- `frontend/src/lib/auth.js`
- `frontend/src/pages/AuthCallbackPage.jsx`

Do not claim production OAuth is fully verified without a dated callback test.

### Solana Mobile

**Status:** Dependency present; product readiness depends on packaging/submission.

Evidence:

- backend package includes `@solana-mobile/wallet-adapter-mobile`.
- frontend package includes `@solana-mobile/wallet-adapter-mobile`.

Do not claim Solana dApp Store readiness until mobile packaging/submission assets and wallet adapter behavior are validated on target devices.

## Mock / Stub Watchlist

These areas need conservative wording:

- v0 docs and release notes marked mock are historical/mock by design.
- Any route that returns 501 due to missing env is not production-ready.
- Portfolio values must not claim complete real P&L unless confirmed from wallet/API.
- LP lock pending/unknown/unverified must not be displayed as Verified.
- Marketing concepts such as Shield Points, badges, leaderboards, premium access, ambassadors and token/NFT rewards are roadmap/future unless code and policy exist.

## Brand Standard

Use:

- `Bags Shield` for the product/company name.
- `BagsShield` only for a logo lockup, social handle, visual mark or exact account handle.

## Current Positioning

Approved strategic narrative:

> Bags Shield is a Solana-native transparency, security and quality platform for tokens. It combines multi-source scan, ShieldScore with coverage, safe swap/pre-trade risk checks, native protocol LP lock verification, evidence-based verified badges and a roadmap for monitoring and alerts. The principle is proof, not promises.

