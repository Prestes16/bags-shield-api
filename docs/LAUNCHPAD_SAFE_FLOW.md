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

When public writes are paused, calls to `/api/launchpad/create-config`,
`/api/launchpad/create-launch-transaction`, and `/api/launchpad/send` return
`LAUNCHPAD_SAFE_MODE_PAUSED` before any transaction is created or broadcast.

Internal launch testing is controlled by:

```text
LAUNCHPAD_PUBLIC_WRITES_ENABLED=true
```

Do not enable this in public production without explicit approval. When enabled
in the internal environment, `/api/launchpad/preflight` can return
`launchAllowed: true` and `safetyStatus: "internal_enabled"` if all fee-share
checks pass and `LAUNCHPAD_PARTNER_CONFIG` is configured.

The app must show the internal launch summary before requesting a signature:

1. Creator: `9500` bps.
2. Bags Shield: `500` bps.
3. `tipLamports = 0`.
4. Server-side `LAUNCHPAD_PARTNER_CONFIG`.
5. Estimated spend.

The user must explicitly confirm that summary before the wallet signature prompt.
`/api/launchpad/send` remains a separate endpoint and only broadcasts a
user-signed transaction after the create-launch-transaction step returns a valid
transaction.

## Separate Setup Recovery

If Bags returns separate fee-share setup transaction(s), the public App2 flow
must stop before requesting another signature. A confirmed setup transaction is
not enough proof that a safe final launch transaction is available.

The recovery path is read-only:

1. Persist setup signatures locally by wallet and draft.
2. Call `/api/launchpad/setup-status` to inspect ledger status, fees, SOL
   deltas, and program IDs.
3. Show the user that repeating setup can spend more SOL.
4. Keep final launch disabled until the backend can prove that Bags returns a
   config key without additional setup transactions.

`/api/launchpad/setup-status` never signs, sends, broadcasts, returns a
serialized transaction, or mutates launch provenance.

## Partner Config Path

Bags supports partner configurations for collecting partner fees from launches.
This is the candidate path for reactivating public launches without asking each
creator to sign a separate fee-share config transaction.

Current rules:

1. The partner wallet is the official Bags Shield fee-share wallet:
   `7ZybPucnSryE5BydcARdc4Q2gz1SaospMVRyQ2LCeyRi`.
2. A partner key/config must be created outside the public user flow by an
   admin/operator flow.
3. A normal user must never sign a partner/config creation transaction.
4. `LAUNCHPAD_PARTNER_CONFIG` is optional and read-only for diagnostics.
5. If `LAUNCHPAD_PARTNER_WALLET` is set, it must equal the official Bags Shield
   wallet.
6. `LAUNCHPAD_PUBLIC_WRITES_ENABLED` remains false until the final launch flow is
   validated end to end.

The read-only endpoint `/api/launchpad/partner-config/status` reports whether
`LAUNCHPAD_PARTNER_CONFIG` is present and valid. It does not call Bags write
endpoints, return transactions, sign, broadcast, or enable launches.

## Admin Partner Config Creation

The admin-only endpoint `/api/launchpad/partner-config/create-tx` can request a
Bags partner-config creation transaction for the official Bags Shield partner
wallet:

```text
7ZybPucnSryE5BydcARdc4Q2gz1SaospMVRyQ2LCeyRi
```

This endpoint is not used by App2 and is protected by:

```text
x-admin-secret: <LAUNCHPAD_ADMIN_SECRET>
```

It only calls the Bags admin preparation endpoint:

```text
POST /fee-share/partner-config/creation-tx
```

It does not sign, send, broadcast, call `/api/launchpad/send`, or enable public
launches. The returned transaction must be inspected and handled only as an
admin operation outside the public user flow.

`LAUNCHPAD_ADMIN_AUTH_DEBUG=1` is a temporary diagnostic flag for admin-secret
mismatch troubleshooting on this endpoint. When enabled, a rejected admin secret
may return only input lengths and short SHA-256 prefixes; it never exposes the
raw secret. Keep this flag disabled after diagnosis.

After the partner config creation transaction is confirmed by an admin, set:

```text
LAUNCHPAD_PARTNER_CONFIG=<confirmed partner config public key>
```

Even after `LAUNCHPAD_PARTNER_CONFIG` is present, `publicLaunchSafe` remains
`false` and `LAUNCHPAD_PUBLIC_WRITES_ENABLED` must remain false until the final
launch flow is validated end to end.
