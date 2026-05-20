# Bags Shield Launchpad

**Status:** partial / beta
**Last reviewed:** 2026-05-20

The Launchpad is integrated with the Bags Launch v2 flow in the local codebase, but it must not be documented as fully complete or production-ready until controlled real Bags and wallet tests are attached.

## Current State

Implemented locally:

- Token info / metadata route.
- Image upload or public image URL flow.
- Fee quote route.
- Bags fee-share config route.
- Create launch transaction route returning an unsigned transaction.
- Send route for already signed transactions.
- Frontend Launchpad page and step flow.
- LP lock status UI in monitor/verification mode.

Needs real validation:

- Real Bags upstream responses in production.
- Wallet signing behavior with the returned launch transaction.
- Fee collection and fee-share audit from real config/transaction data.
- No unauthorized mainnet launch during testing.

## LP Lock Narrative

Bags Shield does not execute LP lock.

The Launchpad may record lock intent and check native protocol evidence later. For Meteora DBC, Bags Shield can verify protocol/native lock evidence when available. States such as `pending`, `unknown`, `pool_detected`, `monitor_only` or `unverified` are not Verified.

## Documentation

- [API.md](./API.md)
- [SETUP.md](./SETUP.md)
- [INTEGRATION.md](./INTEGRATION.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [THREAT_MODEL.md](./THREAT_MODEL.md)
- [HARDENING.md](./HARDENING.md)
- [TESTING.md](./TESTING.md)

Project-wide source of truth:

- [../CURRENT_STATE.md](../CURRENT_STATE.md)
- [../ROADMAP_TRANSPARENTE.md](../ROADMAP_TRANSPARENTE.md)
- [../SECURITY_TRANSPARENCY.md](../SECURITY_TRANSPARENCY.md)
