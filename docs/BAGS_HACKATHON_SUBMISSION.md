# Bags Hackathon Submission Pack

Internal pack for the Bags Hackathon submission form, pitch, demo script and evidence review.

Last reviewed: 2026-05-20

Principle: **Proof, not promises.**

## 1. Project Name

Bags Shield

## 2. One-line Pitch

Bags Shield is the proof layer for Bags launches, helping creators show token quality and helping traders understand risk before they buy.

## 3. Short Description

Bags Shield is a Solana-native transparency and security platform for tokens launched or traded around the Bags ecosystem. It combines multi-source scans, ShieldScore with source coverage, safe swap checks, Bags launch flow support, fee-sharing transparency, LP lock verification and evidence-based verified states.

The goal is not to promise that a token is safe. The goal is to show what can be proven, what is pending, and what remains unknown.

## 4. Long Description

Bags Shield is built as a transparency layer on top of the token launch and trading lifecycle in Solana. It is designed for the moment when a new token is about to be created, discovered, evaluated, swapped, monitored or claimed.

For creators, Bags Shield helps make a launch more accountable: token metadata, launch configuration, fee-sharing, treasury visibility, platform fees, wallet signing boundaries and post-launch verification states are surfaced in a structured flow.

For traders, Bags Shield provides a pre-trade view of risk using multiple data sources, ShieldScore, source coverage, liquidity and authority checks, pool visibility and explicit unknown states. A token that cannot be verified should not appear as verified.

For the Bags ecosystem, Bags Shield can act as a complementary verification and quality layer: creation through Bags flow, fee-sharing configuration, bonding-curve launch context, scan, verified badge states, safe swap and monitoring roadmap.

Current status is beta. Several pieces are implemented locally and wired through the app, but production validation with real wallets, real Bags responses and controlled on-chain transactions is still required before stronger public claims.

## 5. Problem

New Solana tokens, especially fast-moving launch tokens, suffer from information asymmetry.

Creators often struggle to prove that a launch is clean, transparent and serious. Traders often need to decide quickly with incomplete information about authorities, liquidity, holders, fee model, creator behavior, launch configuration, LP state, bonding curve state and pre-trade execution risk.

Common gaps include:

- unclear mint/freeze authority status;
- incomplete liquidity and pool context;
- unclear fee-sharing or partner economics;
- launch cost and platform fee confusion;
- weak source coverage for risk decisions;
- ambiguous LP lock claims;
- unverified badges presented as trust signals;
- unsafe swap flows without enough pre-trade context.

Bags Shield addresses this with a simple rule: if there is no evidence, the UI and docs must say pending, unknown or unverified.

## 6. Solution

Bags Shield provides a product layer for proof-oriented token quality:

- multi-source scan using Solana/RPC, Helius, DexScreener, Birdeye, Meteora, Orca and other provider surfaces where configured;
- ShieldScore with risk reasons and source coverage;
- safe swap / pre-trade checks around Jupiter swap routes;
- Bags Launchpad beta flow for token info, fee quote, fee-share config, unsigned launch transaction and signed transaction broadcast;
- transparent launchpad fee quote before signing;
- Bags fee-sharing visibility for creator and Bags Shield split where configured;
- LP lock verification that checks native protocol evidence, starting with Meteora DBC graduation/lock states and related Meteora pool evidence where applicable;
- verified states based on evidence instead of marketing promises;
- monitoring and alerts as roadmap.

Bags Shield does not custody user funds, does not sign user transactions in the backend, and does not execute LP locks. The user's wallet signs user transactions.

## 7. Bags Integration

### Implemented locally / repository evidence

Evidence from local code and docs:

- Server-side Bags API adapter: `src/lib/launchpad/bags-client.ts`.
- Token info route: `POST /api/launchpad/token-info`.
- Fee quote route: `POST /api/launchpad/fee-quote`.
- Fee-share config route: `POST /api/launchpad/create-config`.
- Launch transaction route: `POST /api/launchpad/create-launch-transaction`.
- Signed launch broadcast route: `POST /api/launchpad/send`.
- Fee claim position route: `GET /api/launchpad/fee-claims/positions`.
- Fee claim transaction route: `POST /api/launchpad/fee-claims/transactions`.
- Frontend Launchpad flow: `frontend/src/pages/LaunchpadPage.jsx`.
- Frontend API hooks: `frontend/src/lib/hooks/useApi.js`.

Confirmed upstream Bags paths used by the local adapter:

- `POST /token-launch/create-token-info`
- `POST /fee-share/config`
- `POST /token-launch/create-launch-transaction`
- `GET /fee-share/user-positions`
- `POST /fee-share/claim-v3`

The local implementation keeps `BAGS_API_KEY` server-side and uses the frontend only against the Bags Shield backend.

### Implemented but needs production validation

- Real token info creation through Bags with multipart image upload or public image URL.
- Real Bags fee-share config response and `configKey` use.
- Real unsigned launch transaction returned by Bags and signed by the wallet.
- Real broadcast through `/api/launchpad/send`.
- Launchpad platform fee collection through `tipWallet` / `tipLamports`.
- Creator/Bags Shield fee-share split using the default/proposed 9500/500 bps model, subject to final Bags config and production validation.
- Fee claim position and claim transaction flow with a wallet that has claimable positions.

### In progress

- LP lock verification for Bags/Meteora DBC launches. Bags Shield does not execute LP lock. It checks native protocol evidence after graduation, lock-state and pool data is available.
- Production-grade proof that the displayed LP lock state matches Meteora DBC graduation/lock states and related Meteora pool evidence for a real launch.
- Clear post-launch monitoring states for pending, unknown, unverified and verified.

### Roadmap

- Automated monitoring and alerts for Bags launches after creation.
- Public evidence pages for verified Bags launches.
- Stronger launch quality reports after real on-chain launches.
- Deeper creator reputation and fee claim analytics.

## 8. Solana Integration

Confirmed locally:

- Solana wallet adapter integration in the frontend.
- Launch transaction signing is performed by the user's wallet, not the backend.
- Backend `/api/launchpad/send` broadcasts only a user-signed transaction through server-side RPC configuration.
- Jupiter swap routes exist through `/api/quote`, `/api/order`, `/api/execute` and `/api/swap`.
- Wallet token surfaces include SPL and Token-2022 handling paths.
- Scan surfaces reference Helius/RPC, DexScreener, Birdeye, Meteora and Orca providers.
- Solana Mobile wallet adapter dependencies are present in backend and frontend package manifests.

Readiness / roadmap validation:

- Real wallet mainnet safe swap with small amount.
- Real launch wallet signing with a controlled Bags launch boundary.
- Solana Mobile device, packaging and dApp Store readiness. Current evidence is dependency presence, not device validation.
- Real Token-2022 coverage across wallet and scan surfaces.

## 9. Current Product Status

### Validated locally

- Backend typecheck, smoke and launchpad wrapper are documented as passing in `docs/CURRENT_STATE.md`, with caveats.
- Frontend Craco production build is documented as passing in `docs/CURRENT_STATE.md` and `frontend/README.md`.
- API route inventory is documented as 37 local route handlers under `src/app/api/**/route.ts`.
- Launchpad route contracts and frontend hooks exist locally.

### Implemented but not fully production-validated

- Safe Swap / Jupiter flow.
- Bags Launchpad v2 beta flow.
- Launchpad fee quote and tip-based platform fee path.
- Bags fee-share config.
- Fee claims.
- OAuth callbacks.
- Wallet token portfolio surfaces.

### Partial / beta

- Multi-source scan and ShieldScore coverage.
- Portfolio and fee claim UI.
- LP lock verification.
- Solana Mobile readiness / roadmap; current evidence is dependency presence.
- Public documentation and launch marketing assets.

### Mock / stub

- Historical v0 docs and release notes contain mock/stub references.
- Any route that depends on missing env keys can return unavailable states.
- Portfolio or market data should be treated as partial unless backed by live provider responses.
- LP lock pending, unknown or unverified states must not be shown as verified.

### Roadmap

- Monitoring and alerts.
- Public evidence pages.
- Extended creator reputation.
- Mobile launch campaign.
- Ambassador, referral, points or reward programs.

## 10. What Works Today

Based on local repository evidence:

- The app has scanner, scan result, swap, launchpad, portfolio, auth and settings surfaces.
- The backend has scan, simulate, wallet, auth, swap, launchpad, LP lock and fee-claim route families.
- Launchpad frontend calls backend routes for fee quote, token info, config, launch transaction, send and LP lock scheduling.
- Token-info supports local image upload through multipart form data and image URL fallback.
- Metadata URL is optional in the launch flow.
- Create-launch-transaction accepts an `ipfs` value derived from token metadata.
- Fee quote exposes base fee, verified fee, liquidity fee, total platform fee, treasury wallet and default/proposed 9500/500 bps fee-share information, subject to final Bags config and production validation.
- LP lock is represented as monitor/verification mode, not custody or lock execution.
- The backend does not sign user launch transactions.

## 11. What Is In Progress

- Controlled production validation of the full Bags Launchpad flow.
- Real Bags response validation for token info, fee-share config and launch transaction.
- Real post-signature boundary testing without unauthorized mainnet launch.
- LP lock verification against real Meteora DBC graduation/lock states and related Meteora pool evidence.
- Fee claim validation with a wallet that has real claimable Bags fee positions.
- Production OAuth callback verification.
- Mainnet safe swap validation with a small real wallet transaction.

LP Lock status for submission:

> In progress. Bags Shield verifies native protocol lock evidence, starting with Meteora DBC graduation/lock states and related Meteora pool evidence where applicable. Bags Shield does not execute LP lock and does not mark pending, unknown or unverified states as verified.

## 12. Roadmap After Hackathon

### Now

- Complete controlled Bags Launchpad production validation.
- Record a demo without unauthorized real launch.
- Validate frontend and backend production env configuration.
- Verify that all fees shown before signing are included in the transaction/config path.
- Document source coverage and known degraded states.

### Next

- Add public evidence pages for Bags launches.
- Add monitoring for post-launch state changes.
- Improve LP lock verification proof display.
- Validate fee claims with real positions.
- Add a public indicator matrix for ShieldScore.
- Harden browser QA for scanner, safe swap, launchpad, auth and portfolio.

### Later

- Alerts and watchlists.
- Creator reputation and historical launch quality.
- Solana Mobile packaging and dApp Store readiness.
- Premium analytics and team dashboards.
- Optional rewards or partner programs, only after product/security design.

## 13. Why Bags Shield Matters for Bags

Bags Shield can improve trust in the Bags ecosystem without competing with the Bags App.

It adds a complementary proof layer:

- creators can show launch quality with evidence;
- traders can understand risk before buying;
- fee-sharing and launch economics become more visible;
- LP lock claims are tied to native protocol evidence instead of promises;
- unknown states are explicit instead of hidden;
- safe swap checks help reduce blind execution;
- post-launch monitoring can improve retention and creator accountability.

The result is a healthier launch environment: fewer vague claims, more observable quality, and better decisions for both creators and traders.

## 14. Demo Script

Target: 2-3 minutes.

1. Open the Bags Shield app.
   - Position it as a proof layer for Bags launches: "Proof, not promises."

2. Scan a token.
   - Show ShieldScore, badge/state, risk reasons and source coverage.
   - Explain that low coverage is not the same as verified safety.

3. Show risk reasoning.
   - Highlight authorities, liquidity/pool information, holders/market data where available, and explicit unknown states.

4. Show safe swap.
   - Open the swap flow and explain that the product is designed to check risk before a user signs.
   - Do not claim full production readiness unless a real mainnet swap has been validated.

5. Show Launchpad.
   - Walk through token creation inputs, image upload, metadata generation, fee quote, fee-share split and unsigned launch transaction creation.
   - Explain that Bags Shield uses Bags token launch routes server-side and keeps the Bags API key off the frontend.

6. Show fee-sharing and treasury visibility.
   - Show the default/proposed creator 95% / Bags Shield 5% fee-share model and the platform fee quote before signing.
   - Explain that these still require controlled production validation before being marketed as fully proven.

7. Show LP lock verification.
   - Present it as in progress / verification-only.
   - Say: "Bags Shield does not execute LP lock. It verifies native protocol evidence, starting with Meteora DBC graduation/lock states and related Meteora pool evidence where applicable."

## 15. Hackathon Milestone

Hackathon milestone target:

- Present Bags Shield as a working beta proof layer for Bags launches.
- Demonstrate scanner, ShieldScore and source coverage with explicit unknown/degraded states.
- Demonstrate safe swap intent and pre-trade risk context without claiming final production readiness until a real wallet test is complete.
- Demonstrate the Bags Launchpad beta flow up to the approved safe boundary: token inputs, image upload, fee quote, fee-share visibility, unsigned launch transaction creation and wallet-signing boundary.
- Demonstrate transparent fee language, including platform fee quote and default/proposed 9500/500 bps fee-share model subject to final Bags config and production validation.
- Demonstrate LP lock verification as in progress, read-only and evidence-based: Bags Shield does not execute LP lock.
- Prepare app URL, repository, screenshots and demo video for judges.

Success criteria for the hackathon submission:

- No fake success states.
- No claim that Bags Shield guarantees token safety.
- No claim that Bags Shield competes with Bags App.
- Clear explanation that Bags Shield increases trust around Bags launches by showing evidence, sources, states and limits.

## 16. Team / Contact

Primary project contact:

- Name: Cleiton / Bags Shield team
- Role: Founder / builder
- Contact email:
- X/Twitter:
- GitHub:
- Website:

Internal note: fill public contact links before final submission.

## 17. Links Needed

Checklist before official submission:

- App URL:
- Website:
- GitHub:
- Demo video:
- Logo/icon:
- Screenshots:
- Contact email:
- X/Twitter:
- Docs:
- Backend API URL:
- Pitch deck, optional:

## 18. Assets Needed

- App logo and icon in square format.
- 3-5 screenshots:
  - scanner result;
  - source coverage / ShieldScore;
  - safe swap;
  - launchpad fee quote;
  - LP lock verification state.
- 2-3 minute demo video.
- Public README or one-page landing copy.
- Short founder/contact bio.
- Optional pitch deck.

## 19. Transparency / Risk Notes

- Bags Shield does not guarantee profit.
- Bags Shield does not guarantee absolute safety.
- Bags Shield reduces information asymmetry by showing evidence, sources and limits.
- Verified means verified according to available sources and implemented checks, not a formal audit.
- Unknown, pending and unverified states must be explicit.
- LP lock verification depends on protocol-specific evidence and available provider data. Bags Shield starts with Meteora DBC graduation/lock states and related Meteora pool evidence where applicable, without treating DBC and pool evidence as the same thing.
- Bags Shield does not execute LP lock.
- Bags Shield backend does not sign user transactions.
- The user wallet signs user transactions.
- Provider data can be stale, missing or degraded.
- Production claims require dated evidence from build, smoke, wallet test, Bags response or on-chain transaction.

## 20. Final Submission Draft

### Project name

Bags Shield

### Tagline

Proof, not promises, for Bags token launches.

### Short pitch

Bags Shield is a Solana-native proof layer for Bags launches. It helps creators launch with more transparency and helps traders evaluate token risk before buying through multi-source scan, ShieldScore, source coverage, safe swap checks, Bags launch flow support, fee-sharing visibility and native protocol LP lock verification.

### Long pitch

Bags Shield is built for the full lifecycle of a new Bags ecosystem token: creation, launch configuration, fee-sharing, bonding-curve launch context, verification, scan, safe swap and post-launch monitoring.

The product is designed around one principle: proof, not promises. A badge should not appear verified because a creator says so. It should appear verified only when the app can show evidence from code, provider data, protocol state or on-chain signals. When something cannot be proven, Bags Shield shows it as pending, unknown or unverified.

For creators, Bags Shield offers a clearer launch flow with token info creation, image upload, launch fee quote, fee-share visibility, unsigned transaction handling and wallet-side signing. For traders, it provides a risk intelligence layer with ShieldScore, source coverage, liquidity and authority checks, safe swap flow and transparent limits.

The Bags integration is implemented in beta through server-side routes that call Bags token launch and fee-share endpoints while keeping `BAGS_API_KEY` off the frontend. The Launchpad flow is wired locally for token info, fee quote, fee-share config, launch transaction creation and signed transaction broadcast, but still needs controlled production validation with real Bags responses and approved on-chain boundaries. The default/proposed fee-share model is 9500/500 bps, subject to final Bags config and production validation.

LP lock is intentionally described with precision: Bags Shield does not execute LP lock. It verifies native protocol lock evidence, starting with Meteora DBC graduation/lock states and related Meteora pool evidence where applicable. Pending or unknown states are never treated as verified.

### Bags integration summary

Implemented locally / repository evidence:

- Bags token-info route through `POST /api/launchpad/token-info`.
- Bags fee-share config route through `POST /api/launchpad/create-config`.
- Bags launch transaction route through `POST /api/launchpad/create-launch-transaction`.
- Fee quote route through `POST /api/launchpad/fee-quote`.
- Signed transaction broadcast through `POST /api/launchpad/send`.
- Fee claim routes for claimable positions and claim transactions.
- Frontend Launchpad integration through `LaunchpadPage.jsx` and `useApi.js`.

Needs production validation:

- Real Bags Launchpad end-to-end response flow.
- Real fee-share config audit.
- Real platform fee in transaction path.
- Real fee claim wallet test.
- Real LP lock verification against Meteora DBC graduation/lock states and related Meteora pool evidence.

### Current status

Bags Shield is beta. The local codebase contains the core app surfaces and server routes for scanner, safe swap, launchpad, fee quote, Bags integration, LP lock verification and fee claims. Local documentation records successful frontend build and backend typecheck/smoke checks with caveats. Production readiness requires controlled wallet, Bags and on-chain validation before strong claims.

### Roadmap

Now: validate the Bags launch flow and safe swap with controlled real tests.

Next: publish evidence pages, improve source coverage, verify LP lock states from protocol data and validate fee claims.

Later: add monitoring, alerts, creator reputation, Solana Mobile readiness planning and premium analytics.

### Why this should be selected

Bags Shield directly improves the quality and trust layer around Bags launches. It helps serious creators prove what they are doing and helps traders see risk before signing. It is complementary to the Bags App: Bags launches the token lifecycle, while Bags Shield makes the evidence around that lifecycle easier to inspect, understand and trust.

The project is valuable because it does not sell certainty. It makes uncertainty visible.

## 21. Form-ready Short Submission

### One-line pitch

Bags Shield is the proof layer for Bags launches, helping creators show token quality and helping traders understand risk before they buy.

### Short pitch

Bags Shield is a Solana-native transparency and security platform for the Bags ecosystem. It combines multi-source scan, ShieldScore with source coverage, safe swap checks, Bags launch flow support, fee-sharing visibility and evidence-based LP lock verification. The core principle is simple: proof, not promises.

### Long pitch

Bags Shield is built around the full lifecycle of a Bags token launch: creation, launch configuration, fee-sharing, bonding-curve context, verification, scan, safe swap and monitoring. It helps creators present stronger evidence around their launches and helps traders understand risk before they sign or buy.

The product is intentionally transparent about uncertainty. Verified means evidence exists from implemented checks, provider data, protocol state or on-chain signals. Pending, unknown and unverified states remain explicit. Bags Shield does not guarantee safety or profit, and it does not execute LP lock.

For the Bags ecosystem, Bags Shield is a complementary trust layer, not a competitor to the Bags App. Bags launches the lifecycle; Bags Shield makes the evidence around that lifecycle easier to inspect, understand and trust.

### Bags integration summary

Implemented locally / repository evidence: server-side Bags adapter, token-info route, fee quote route, fee-share config route, launch transaction route, signed transaction broadcast route, fee-claim routes, and Launchpad frontend integration. The backend keeps `BAGS_API_KEY` server-side and the frontend calls the Bags Shield backend only.

Needs production validation: real Bags token info response, final Bags fee-share config, real unsigned launch transaction, platform fee in transaction path, fee claim wallet test and LP lock verification from Meteora DBC graduation/lock states plus related Meteora pool evidence where applicable. The default/proposed fee-share model is 9500/500 bps, subject to final Bags config and production validation.

### Current beta status

Bags Shield is beta. The repository shows implemented app surfaces and backend routes for scanner, safe swap, launchpad, fee quote, Bags integration, LP lock verification and fee claims. Local docs record frontend build and backend typecheck/smoke evidence with caveats. Strong production claims require controlled wallet, Bags and on-chain validation.
