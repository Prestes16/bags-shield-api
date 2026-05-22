# Manual Swap Fee Fallback

## Overview

Bags Shield charges an integrator fee on every swap. The **preferred** mechanism is
Jupiter's referral-fee program: when `/api/order` is called with a valid
`JUPITER_REFERRAL_ACCOUNT` and `referralFee`, Jupiter embeds the fee into the swap
transaction itself and the user signs exactly one transaction.

When Jupiter does **not** confirm the requested fee (HTTP 502 `SWAP_FEE_NOT_APPLIED`),
swap execution is blocked to prevent silent zero-fee execution. This document describes
the **manual fee fallback** that the frontend can offer as an alternative path.

---

## Flow Diagram

```
Frontend                         /api/order                      Jupiter API
   │                                  │                               │
   │── GET /api/order ───────────────►│── GET /order?referralFee=50 ─►│
   │                                  │◄── { feeBps: 2 } ─────────────│
   │◄── 502 SWAP_FEE_NOT_APPLIED ─────│
   │    + manualFeeAvailable: true    │
   │    + manualFeeQuoteEndpoint      │
   │                                  │
   │── GET /api/swap/manual-fee/quote ──────────────────────────────► (no external call)
   │◄── { feeLamports, feeWallet, memo, expiresAt, verifyEndpoint }
   │
   │  [User reviews fee and approves]
   │
   │── User signs & sends SOL transfer to feeWallet (via wallet adapter) ──► Solana
   │◄── signature
   │
   │── POST /api/swap/manual-fee/verify { signature, expectedFeeLamports, … }
   │                                         │
   │                              [RPC getTransaction + balance-delta check]
   │◄── 200 { feeProof: { verified: true, … } }
   │
   │  [Frontend holds feeProof — NOT YET WIRED TO SWAP EXECUTION]
```

---

## API Endpoints

### `GET /api/swap/manual-fee/quote`

Returns a fee quote in SOL lamports for a pending swap.

**When to call**: After receiving `SWAP_FEE_NOT_APPLIED` from `/api/order`, if the user
chooses the manual fee path.

**Query parameters**

| Param | Required | Description |
|---|---|---|
| `inputMint` | ✅ | Input token mint (base58, 32–44 chars) |
| `outputMint` | ✅ | Output token mint |
| `amount` | ✅ | Input amount in base units (positive integer string) |
| `userPublicKey` | ✅ | User wallet address |
| `quoteUsdValue` | ❌ | Estimated USD notional value (reserved for future price-based calculation) |

**Response (200)**

```jsonc
{
  "success": true,
  "response": {
    "manualFeeRequired": true,
    "feeMode": "manual_sol_transfer",
    "feeBps": 50,
    "feeLamports": "5000",          // string to preserve precision
    "feeWallet": "7ZybP…",          // authorised fee recipient
    "memo": "bags-shield:<requestId>",
    "expiresAt": "2026-01-01T00:05:00.000Z",
    "ttlSeconds": 300,
    "basis": "flat_minimum_non_sol_input",  // or "bps_of_sol_input" / "minimum_floor" / "maximum_cap"
    "verifyEndpoint": "/api/swap/manual-fee/verify",
    "_note": "Send a SOL transfer of at least feeLamports to feeWallet…"
  },
  "meta": { "requestId": "…" }
}
```

**Fee calculation logic**

- If `inputMint` is SOL (`So111…112`):
  `fee = clamp(floor(amount × feeBps / 10000), MIN, MAX)`
- Otherwise (SPL token input): flat `MIN` fee — no external price oracle is called.

**Env vars consumed**

| Var | Default | Description |
|---|---|---|
| `SWAP_MANUAL_FEE_BPS` | `APP_FEE_BPS` (50) | Basis points to charge |
| `SWAP_MANUAL_MIN_FEE_LAMPORTS` | `5000` | Floor fee (≈ 0.000005 SOL) |
| `SWAP_MANUAL_MAX_FEE_LAMPORTS` | `2000000` | Cap fee (0.002 SOL) |
| `SWAP_MANUAL_FEE_WALLET` | `APP_FEE_COLLECTOR_OWNER` | Authorised recipient |
| `SWAP_MANUAL_QUOTE_TTL_SECONDS` | `300` | Quote validity window |

**Rate limit**: 60 requests / minute per IP.

---

### `POST /api/swap/manual-fee/verify`

Verifies that a SOL transfer to the fee wallet was confirmed on-chain and returns a
signed proof object.

**When to call**: After the user's wallet has sent the SOL transfer and returned a
transaction signature.

**Request body**

```jsonc
{
  "signature": "<base58 tx sig, 87–88 chars>",
  "userPublicKey": "<sender wallet>",
  "expectedFeeLamports": "5000",   // string or number
  "feeWallet": "7ZybP…",           // must equal authorised wallet
  "requestId": "<correlationId>"   // optional, for log correlation
}
```

**Verification steps (all must pass)**

1. Transaction exists and is confirmed/finalised on-chain.
2. `meta.err === null` — transaction did not fail.
3. `blockTime` is present and within `VERIFY_MAX_AGE_SECONDS` of now.
4. `accountKeys[0]` (fee payer) equals `userPublicKey`.
5. `postBalances[feeWalletIndex] − preBalances[feeWalletIndex] ≥ expectedFeeLamports`.
6. `feeWallet` in the request body must equal the server-configured authorised wallet
   (prevents attempts to claim payment to an arbitrary address).

**Response (200 — verified)**

```jsonc
{
  "success": true,
  "response": {
    "feeProof": {
      "mode": "manual_sol_transfer",
      "signature": "<full sig>",
      "feeLamports": "5000",
      "feeWallet": "7ZybP…",
      "verified": true,
      "blockTime": 1700000000,
      "feePayer": "<userPublicKey>",
      "correlationId": "<requestId or null>",
      "verifiedAt": "2026-01-01T00:01:00.000Z"
    },
    "_note": "This proof confirms the fee was paid on-chain. It is NOT yet wired to swap execution…"
  },
  "meta": { "requestId": "…" }
}
```

**Error codes**

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `INVALID_FEE_WALLET` | `feeWallet` does not match authorised wallet |
| 402 | `FEE_NOT_VERIFIED` | On-chain check failed (see `reason` field) |
| 429 | `RATE_LIMIT` | 30 req/min per IP exceeded |
| 502 | `VERIFY_RPC_ERROR` | Solana RPC call failed |

**`reason` values for `FEE_NOT_VERIFIED`**

- `transaction_not_found_or_not_confirmed`
- `transaction_failed_on_chain`
- `block_time_missing`
- `transaction_too_old_age_<N>s_limit_<M>s`
- `fee_payer_mismatch`
- `fee_wallet_not_in_transaction`
- `balance_metadata_missing`
- `insufficient_fee_received_got_<N>_expected_<M>`

**Env vars consumed**

| Var | Default | Description |
|---|---|---|
| `SOLANA_RPC_URL` | — | RPC endpoint (required) |
| `SWAP_MANUAL_FEE_WALLET` | `APP_FEE_COLLECTOR_OWNER` | Authorised recipient |
| `VERIFY_MAX_AGE_SECONDS` | `600` | Max transaction age (10 min) |

**Rate limit**: 30 requests / minute per IP.

---

## What Is NOT Implemented Yet

> ⚠️ The `feeProof` object returned by `/verify` is **not yet accepted** by
> `/api/order` or `/api/execute`. The swap itself still requires a valid Jupiter
> referral fee confirmation.

The following integration work is a **separate future step**:

- Accepting `feeProof` as a body parameter in `/api/execute` (or a new
  `/api/swap/execute-with-manual-fee` route).
- Validating that the `feeProof.signature` has not been reused (replay protection).
- Wiring the `feeProof` into the swap transaction pipeline so the swap is released
  when proof is present and valid.

Until that work is done, the manual fee flow ends at verification — the user receives
a `feeProof` receipt, but cannot yet complete the swap through the Bags Shield API.

---

## Security Properties

| Property | How it is enforced |
|---|---|
| Fee cannot be claimed to an arbitrary wallet | `feeWallet` in verify body is checked against `SWAP_MANUAL_FEE_WALLET` / `APP_FEE_COLLECTOR_OWNER` on the server |
| Fee amount cannot be under-reported | Server computes `post − pre` balance delta from RPC, not from user input |
| Replay of old transactions | `blockTime` must be within `VERIFY_MAX_AGE_SECONDS` (default 10 min) |
| Wrong sender | `accountKeys[0]` must equal `userPublicKey` |
| Failed transactions | `meta.err === null` is checked; failed txs are rejected |
| No secrets in frontend | `feeWallet` is public; all verification is server-side |
| Swap still blocked | `SWAP_FEE_NOT_APPLIED` still returns HTTP 502; swap execution unchanged |

---

## Policy: Swap Failure After Fee Payment

If a user has paid the manual fee (verified, `feeProof` returned) but the swap
subsequently fails (network error, slippage, RPC timeout), the user has paid SOL
and received nothing.

**Current state**: This is a known edge case. The manual fee is explicitly described
as a fallback that is not yet wired to swap execution, so no swap can currently be
attempted after paying a manual fee through this API.

**When integration is built**, the recommended policy is:

1. The `feeProof` signature should be stored server-side upon first use and rejected
   on reuse (replay protection).
2. If the swap fails after the fee is consumed, the refund policy should be documented
   in the user-facing UI before the user is asked to sign the fee transfer.
3. Consider a time-locked re-use window (e.g., 10 minutes) so that a user who paid but
   didn't complete the swap due to transient error can retry without paying again.

---

## Env Var Summary

Add the following to `.env.local` (development) or Vercel env vars (production):

```bash
# Manual fee fallback — all optional, defaults shown
SWAP_MANUAL_FEE_BPS=50
SWAP_MANUAL_MIN_FEE_LAMPORTS=5000
SWAP_MANUAL_MAX_FEE_LAMPORTS=2000000
SWAP_MANUAL_FEE_WALLET=<your fee wallet pubkey>
SWAP_MANUAL_QUOTE_TTL_SECONDS=300
VERIFY_MAX_AGE_SECONDS=600

# Required for verify endpoint
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<key>
```
