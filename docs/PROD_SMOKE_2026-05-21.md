# Production Smoke Evidence - 2026-05-21

Purpose: sanitized evidence notes for the current Bags Shield production surface.

Principle: **proof, not promises**. This document records what was observed without exposing secrets or claiming stronger readiness than the evidence supports.

## Scope

Production API base used by the app:

- `https://api.bagsshield.org`
- Legacy Vercel API aliases may exist, but public docs should prefer the canonical API domain when possible.

Routes covered:

- `GET /api/quote`
- `POST /api/launchpad/fee-quote`
- `POST /api/scan`
- Paywall/quota behavior for `/api/scan`

## Sanitized Evidence

Latest local script run:

- Command: `powershell -ExecutionPolicy Bypass -File scripts\smoke-prod-app2.ps1`
- Paywall probe: skipped to avoid intentionally consuming production free quota.

| Route | Observed result | Request ID | Notes |
|---|---:|---|---|
| `GET /api/quote` | `success=true` | present | Jupiter quote returned successfully. Platform fee observed at `50` bps. |
| `POST /api/launchpad/fee-quote` | `success=true` | present | `feeMode=tipWallet_plus_feeShare`. Default/proposed fee-share model is `creator=9500` bps / `Bags Shield=500` bps, subject to final Bags config and production validation. |
| `POST /api/scan` | `success=true` | present | USDC scan returned `badge=CAUTION`, `score=55`, `coverage=3/3 enabled sources OK`, `disabledSource=meteora`, and integrity hash/signature were present. |
| `/api/scan` quota/paywall | `HTTP 402` expected after free quota | present when returned | `DAILY_QUOTA_EXCEEDED` is the expected paywall state after the free daily scan limit. Probe is optional because it intentionally consumes free quota. |

## Scanner Coverage Notes

Coverage counts enabled scanner sources separately from disabled or degraded sources.

Expected wording:

- `Coverage: 3/3 enabled sources OK`
- `Meteora: disabled for scanner reliability`

Meteora scanner provider is intentionally disabled for reliability. It should appear as disabled/degraded metadata, not as a hidden failure and not as a fatal scan error.

LP lock verification remains a separate in-progress evidence path. Bags Shield does not execute LP lock. It must not present LP lock as verified until real native protocol evidence exists, starting with Meteora DBC graduation/lock states and related Meteora pool evidence where applicable.

## Canonical Asset Notes

Canonical assets such as USDC or WSOL can receive cautionary authority or metadata checks that are technically valid but more relevant to newly launched tokens and memecoins.

Expected scanner context:

- `CANONICAL_ASSET_CONTEXT`
- `Canonical asset detected. Some authority or metadata checks may not map to meme-token risk assumptions.`

This context must not override the score or hide real findings. It only explains why some launch-risk assumptions may not map cleanly to canonical assets.

## Smoke Script

Use:

```powershell
cd C:\Dev\bags-shield-api
powershell -ExecutionPolicy Bypass -File scripts\smoke-prod-app2.ps1
```

Optional paywall probe:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\smoke-prod-app2.ps1 -IncludePaywallProbe
```

The paywall probe intentionally consumes free scan quota for the caller IP. Run it only when that is acceptable.

The script:

- uses `Invoke-WebRequest -UseBasicParsing`;
- does not print API keys;
- redacts `api-key=...`, bearer tokens and `x-api-key`;
- handles `HTTP 402` without reusing stale response objects;
- prints status code, requestId, success and selected useful fields.

## Security Notes

- No `BAGS_API_KEY` should appear in frontend bundles, docs or logs.
- RPC/API key examples must use `api-key=REDACTED`.
- `unknown`, `pending`, `disabled` and `unverified` states must not be displayed as `verified`.
- Swap/Jupiter fees are separate from Launchpad fees.
