# Bags Shield - Security Transparency

**Last reviewed:** 2026-05-20  
**Principle:** proof, not promises.

This document explains how Bags Shield should describe badges, sources, coverage, verified states and known limits.

## What Bags Shield Is

Bags Shield is a Solana-native transparency, security and quality layer for tokens. It helps users review risk before acting.

It can:

- collect signals from multiple providers;
- compute a ShieldScore server-side;
- show source coverage and degraded states;
- run pre-trade risk checks before swap;
- verify native protocol LP lock when evidence exists;
- prepare wallet-signed flows for launchpad and claims.

It cannot guarantee that a token is safe.

## ShieldScore

ShieldScore is a risk signal, not a certification.

It should be presented with:

- score;
- badge;
- reasons;
- source coverage;
- confidence/degraded state where available;
- timestamp/requestId when available.

Do not describe ShieldScore as:

- fraud-proof;
- rug-proof;
- a guarantee of profit or safety;
- a replacement for user due diligence.

## Data Sources and Coverage

Sources may include:

- Helius / RPC;
- DexScreener;
- Birdeye;
- Meteora;
- Orca;
- Jupiter;
- Bags API.

Coverage means which sources were available for a specific result. If a source fails, is missing or returns incomplete data, the UI/docs should say so. A result with low coverage must not be marketed as fully verified.

## Badge States

Recommended badge taxonomy:

| State | Meaning |
|---|---|
| Verified | Evidence exists in repo/runtime response/on-chain/protocol data for the specific claim. |
| Partial | Some evidence exists, but not enough for a strong claim. |
| Pending | Waiting for async data, pool creation, upstream response or confirmation. |
| Unknown | Bags Shield cannot determine the state. |
| Unverified | No acceptable proof was found. |
| Roadmap | Planned, not implemented. |

## LP Lock Transparency

Correct statement:

> Bags Shield does not execute LP lock. It verifies native protocol lock when there is evidence, especially via Meteora DBC.

Rules:

- `pending` is not Verified.
- `unknown` is not Verified.
- `pool_detected` is not Verified.
- `unverified` is not Verified.
- `monitor_only` means read/observe mode, not custody or locking.
- Tags, heuristics or assumptions must not appear as Verified unless the code path has explicit on-chain/protocol proof.

For Meteora DBC, the correct message is:

> Bags Shield starts with Meteora DBC graduation/lock states and related Meteora pool evidence where applicable. If the pool exists but exact native lock evidence is unavailable, the result is partial or unverified, not a verified lock.

## Wallet and Signing Model

Security rules:

- The backend must not sign user transactions.
- The frontend wallet signs user transactions.
- The backend may create/proxy unsigned transactions.
- The backend may broadcast a signed transaction when the user already signed it.
- Server-side secrets must never be exposed to the frontend.

Server-only examples:

- `BAGS_API_KEY`
- private keys
- RPC keys where configured as secrets
- service role keys

## Fees and Financial Truth

Every fee must be visible before signing.

Categories:

| Category | Meaning |
|---|---|
| Network/rent estimate | Estimated Solana cost; can diverge from final cost. |
| Launchpad service fee | Bags Shield platform fee if included in real transaction/tip flow. |
| Bags fee-share | Recurring fee-share if included in Bags config and verified by response/on-chain evidence. |
| Swap fee | Jupiter/swap fee path; separate from launchpad fees. |
| UI-only | Text or estimate not backed by a real transaction/config. Must be labeled or removed. |

No hidden fees. No fake discounts. No fee claim without transaction/config evidence.

## Known Limits

- Provider data can be stale, incomplete or unavailable.
- Some token risks are social or operational and may not be visible on-chain.
- LP lock status depends on protocol-specific evidence.
- Production OAuth, swap and launchpad flows require dated real tests before strong claims.
- Solana Mobile readiness requires device or package validation.

## Approved Public Narrative

> Bags Shield is built around proof, not promises. It gives Solana users a clearer view of token quality using multi-source scan, ShieldScore with coverage, safe swap checks and evidence-based verification such as native protocol LP lock checks.
