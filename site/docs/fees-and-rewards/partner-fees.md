---
title: Partner Fees
---

Partners who integrate Bags Shield (e.g. wallets, dApps, referrers) may receive a **share of fees** generated from referred or attributed volume. This page outlines how partner fees work.

## Who can be a partner

- **Wallets / dApps**: Integrate our API or widget; we track attribution (e.g. via API key or referral code).
- **Referrers**: Users or entities that drive traffic or volume via a referral link or code.
- **Other integrators**: As defined in separate partner agreements.

Partnership and fee-share terms are agreed in writing; this doc describes the general model.

## Attribution

- **API key**: Requests made with a partner’s API key attribute volume to that partner.
- **Referral code / link**: Users who sign up or trade via a partner’s link or code are attributed to that partner for a defined period (e.g. 30 days).
- **Wallet / dApp**: If the integration identifies the partner (e.g. via header or parameter), swaps are attributed accordingly.

Attribution is used to compute the partner’s share of fees; we do not share personal data beyond what is necessary for settlement.

## Fee-share

- Partners receive a **percentage of fees** (or of volume, depending on the contract) generated from attributed volume.
- The percentage and any caps are set in the partner agreement.
- Payouts may be subject to minimum thresholds and schedule (e.g. monthly).

## Wallets and settlement

- **Payout wallet**: Partners provide a Solana (or agreed) wallet address for receiving their share.
- **Settlement**: We settle in the agreed asset (e.g. USDC, SOL) on the agreed schedule, minus any fees for transfer.
- **Reporting**: Partners may get access to a dashboard or API for volume and earnings; details are in the partner agreement.

## Vaults and custody

- Bags Shield (or our designated service) holds fee revenue in secure vaults until distribution.
- Partner shares are computed from on-chain and off-chain records; we use internal controls and, where applicable, audits to ensure accuracy.

## Rules and changes

- **Eligibility**: We may require KYC, compliance checks, or geographic restrictions for partners.
- **Fraud**: Volume that we determine to be fraudulent (e.g. wash trading, sybil) is excluded from partner calculations and may lead to termination.
- **Changes**: We may change fee-share rates, attribution rules, or settlement terms with notice; the partner agreement and [Terms of Service](/docs/legal/terms) govern.

For specific numbers and contract terms, contact the Bags Shield team or refer to your partner agreement.
