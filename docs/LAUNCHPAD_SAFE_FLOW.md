# Bags Shield Launchpad Safe Flow

## Problem

Earlier Launchpad hardening attempts allowed the public app flow to sign and send
fee-share config transactions before the final token launch transaction existed.
That can spend SOL on configuration while the token is never launched. For Bags
Shield this is a product safety failure: a token attempt is not a token launch.

## Principle: no partial spend

The public Launchpad must not request any wallet signature that can spend SOL
unless the user is signing a safe final launch operation. If Bags requires a
separate config transaction or bundle before launch, the public flow stays
paused.

## Allowed flow while Safety Gate is active

1. Validate draft inputs.
2. Build a read-only fee-share plan.
3. Show creator and Bags Shield fee-share explicitly.
4. Show fee quote and estimated costs.
5. Return `launchAllowed: false`.
6. Never return a serialized transaction for signing.
7. Never call `/api/launchpad/send` with a valid launch payload.

## Blocked flow

1. Signing fee-share config transactions separately.
2. Sending config bundles separately.
3. Signing a tip transaction for Launchpad by default.
4. Marking `token_info_created`, `config_created`, `transaction_created`,
   `submitted`, `failed`, `cancelled`, or `draft` as a launched/tradeable token.
5. Showing launch attempts as Portfolio tokens.

## Fee-share vs tips

Fee-share is recurring revenue from the Bags ecosystem after the token launches
and trades. It is represented by explicit `claimersArray` and
`basisPointsArray`, and the total BPS must be exactly `10000`.

Tips are one-time lamport transfers used by some bundle/priority flows. Tips are
not the Bags Shield app fee. The public Launchpad keeps:

```text
tipLamports = 0
tipWallet = null
```

by default.

## Fee-share requirements

The current official Bags Shield fee-share receiver is:

```text
7ZybPucnSryE5BydcARdc4Q2gz1SaospMVRyQ2LCeyRi
```

If `LAUNCHPAD_TREASURY_WALLET` is set, it must be exactly this wallet. This
wallet is used as a Bags Shield fee-share claimer, not as the default
`tipWallet`.

The fee-share plan must include:

1. The creator wallet explicitly.
2. The Bags Shield treasury/partner wallet explicitly when app fee-share is
   enabled.
3. Matching `claimersArray` and `basisPointsArray` lengths.
4. No negative BPS.
5. No empty wallets.
6. `totalBps = 10000`.

If the Bags Shield fee-share wallet is not available from existing
configuration, the backend must fail closed with:

```text
LAUNCHPAD_FEE_SHARE_WALLET_NOT_CONFIGURED
```

## Portfolio rule

A token appears in Portfolio as a real launched token only when all are true:

1. Status is `confirmed` or `launched`.
2. A launch transaction signature exists.
3. A confirmation timestamp exists.

Pending, failed, draft, or submitted-only attempts stay out of real Portfolio and
Swap launch lists.

## Current public state

Launchpad remains paused. The Safety Gate in App2 must stay active until Bags
Shield has a final-transaction-only launch path or a safe atomic bundle flow
that cannot create partial SOL spend without a launched token.

Server-side public write endpoints are also paused by default. The environment
variable below must stay unset/false in production until the final safe launch
flow is reactivated:

```text
LAUNCHPAD_PUBLIC_WRITES_ENABLED=false
```

When public writes are paused, valid calls to `/api/launchpad/create-config` and
`/api/launchpad/create-launch-transaction` return
`LAUNCHPAD_SAFE_MODE_PAUSED`. Invalid payloads still return validation errors so
negative smokes continue to prove schema behavior.
