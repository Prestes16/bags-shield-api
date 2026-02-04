---
title: Fees & Rewards Overview
---

This section explains how **fees** are computed, capped, and split on Bags Shield, and how **rewards** (e.g. cashback) work.

## Fee model

- **Swap fees**: When you execute a swap through Bags Shield (e.g. via Jupiter aggregation), a fee may be applied on top of the underlying DEX/aggregator costs.
- Fees are typically expressed as a **percentage of swap volume** or as a **fixed amount per trade**, depending on product configuration.
- Fees are set by Bags Shield and may vary by product, partner, or region.

## How fees are computed

1. **Quote**: When you request a quote (e.g. via `/api/quote` or the app), the response may include a `fee` or `feeBps` (basis points) field.
2. **Execution**: The fee is applied at execution time; the exact amount may depend on the final route and size.
3. **Caps**: There is usually a **maximum fee per trade** so that large swaps are not overcharged. For example:
   - Fee = min(percentage × volume, max_fee_usd)

### Example (illustrative)

- Fee rate: 0.3% (30 bps) of swap volume.
- Max fee per trade: 50 USD equivalent.
- Swap volume: 10,000 USD → fee = 30 USD.
- Swap volume: 100,000 USD → fee = 50 USD (capped).

Actual numbers are defined in the API and app; use the returned quote for exact values.

## How fees are split

- A portion of fees may go to **infrastructure** (Bags Shield).
- A portion may be shared with **partners** (e.g. referrers, integrators) as described in [Partner Fees](./partner-fees).
- A portion may be used to fund **cashback** or other user rewards; see [Cashback](./cashback).

Exact split ratios are internal; the user sees the **total fee** they pay, not the breakdown.

## Rewards (cashback)

- Eligible users may earn **cashback** on swap volume, subject to [tiers, limits, and anti-abuse rules](./cashback).
- Cashback is typically a percentage of the fee paid (or of volume), credited back to the user’s balance or account.

## Where to see fees

- **In the app**: The swap confirmation screen shows the total fee (and optionally breakdown) before you sign.
- **In the API**: The quote response includes fee fields; see [API Overview](/docs/api/overview) and [Quote](/docs/api/quote).

## Updates

Fee rates, caps, and split rules may change. Always rely on the latest quote or in-app display for current pricing. [Terms of Service](/docs/legal/terms) govern.
