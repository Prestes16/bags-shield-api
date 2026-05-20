# Bags Shield - Roadmap Transparente

**Last reviewed:** 2026-05-20  
**Principle:** separate what exists now from what is next and what is future vision.

## Agora

These items exist locally and can be documented as implemented, with the validation caveats below.

| Area | State | Evidence / caveat |
|---|---|---|
| Multi-source scan | Partial / beta | API, providers and score modules exist. Needs indicator matrix and production coverage validation. |
| ShieldScore | Partial / beta | Server-side score exists; coverage/confidence must be shown honestly. |
| Safe swap / pre-trade risk check | Implemented, needs real test | Jupiter routes and UI exist. Needs controlled mainnet test with real wallet before public "ready" claim. |
| Launchpad Bags v2 | Partial / beta | Token-info, fee-quote, create-config, create-launch-transaction and send routes exist. Needs controlled real Bags validation. |
| Fee quote and launchpad fees | Partial / beta | Fee calculation exists. Needs real signed transaction evidence to mark platform fee as verified collected. |
| Bags fee-share | Partial / beta | Config flow exists. Needs Bags response/on-chain audit for verified claim. |
| LP lock verification | Partial / beta | Read/monitor/verify path exists. Bags Shield does not execute LP lock. |
| Fee claims | Partial / beta | Claimable positions and claim transaction routes exist. Needs wallet with claimable position. |
| Auth Google/X/Wallet | Partial / beta | Routes/UI exist. Needs fresh production callback tests. |
| Frontend production build | Validated locally | `npx craco build` passed in this review. |
| Backend typecheck/smoke | Validated locally | `npm run typecheck`, `npm run smoke`, `npm run test:launchpad` passed with caveats. |
| Backend Next build | Inconclusive | `npm run build` timed out after 240s without explicit compile error. |

## Proximo

Work needed before stronger production claims.

1. Run a controlled mainnet swap with a real wallet and small amount; record signature, fee behavior and user-facing states.
2. Validate Launchpad Bags v2 in production up to the approved boundary, without unauthorized mainnet launch.
3. Test upload, metadata, fee quote, fee-share config and unsigned transaction creation with real Bags responses.
4. Validate fee claims using a wallet with real claimable positions.
5. Add an auditable indicator matrix for ShieldScore sources, rules and confidence behavior.
6. Add production OAuth callback tests for Google, X/Twitter and wallet linking.
7. Confirm CORS and env configuration for `app.bagsshield.org` and `api.bagsshield.org`.
8. Decide and document how every mock/stub is hidden, disabled or clearly labeled in production.
9. Add browser/manual QA checklist for Launchpad, Portfolio, Swap, Scanner, Auth and Settings.
10. Investigate why backend `next build` times out locally and produce a dated build artifact or failure note.

## Futuro

These are future product capabilities. They must not be marketed as implemented.

- Monitoring and alerts for watched tokens.
- Push notifications / weekly digests.
- Extended wallet portfolio analytics and P&L.
- User-configurable LP lock extension flows if supported by the underlying protocol.
- Automated liquidity or fee claim routing to a custodial/account abstraction model, only if explicitly designed and approved.
- Shield Points, achievements, badges, leaderboard and gamification.
- Premium tiers, referral programs and ambassador tooling.
- Public benchmark against competitors.
- Solana Mobile dApp Store packaging and submission campaign.
- Native mobile packaging if the web/PWA route is not enough.
- Token/NFT reward programs.

## Launch Readiness Gate

Do not declare public launch readiness until all required gates below have evidence:

| Gate | Required evidence |
|---|---|
| Frontend build | Latest successful build command and commit/date. |
| Backend build | Latest successful `next build` or documented deployment build result. |
| Smoke | Local and/or production smoke logs. |
| Swap | Real wallet mainnet test with small amount and signature. |
| Launchpad | Real Bags flow test with no unauthorized launch, plus signed/broadcast boundary clearly documented. |
| LP lock | Verified evidence only; pending/unknown/unverified states labeled honestly. |
| Fees | Platform fee and fee-share visible before signing and auditable after transaction. |
| Security | Secret scan and no frontend exposure of server-only keys. |
| Docs | Current state, roadmap and security transparency updated. |

