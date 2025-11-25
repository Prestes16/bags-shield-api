# Bags Shield API

> Solana-native security gateway for scanning transactions, simulating risk and integrating with the Bags ecosystem.

Bags Shield is an API layer that sits between Solana dApps/wallets and raw on-chain transactions.  
It provides a simple, opinionated interface for:

- Scanning transactions before broadcast;
- Simulating effects and assigning a **ShieldScore** (risk grade);
- Querying token creators and lifetime fees via Bags;
- Helping creators bootstrap their launch configuration with Bags' public APIs.

---

## Status

- **Stage:** Early Alpha (actively evolving)
- **Network focus:** Solana (Bags ecosystem + token launches)
- **Deployment:** Vercel (serverless functions, Hobby plan)

This repository is used both as a production API and as my public Web3 portfolio.  
The goal is to demonstrate real-world experience with Solana integrations, security-minded API design and Vercel infrastructure.

---

## Features

### 🔍 Transaction Scan — `/api/scan`

- **Method:** `POST`
- **Purpose:** Validate and score raw transaction data before sending it on-chain.
- **Output:**
  - `ShieldScore` (0–100)
  - Risk grade (A–E)
  - Risk badges (e.g. liquidity, ownership, mint risks)
  - `isSafe` flag + explanations

### 🧪 Transaction Simulation — `/api/simulate`

- **Method:** `POST`
- **Purpose:** Simulate the effect of a transaction and estimate risk/impact.
- **Output:**
  - `ShieldScore` focused on impact
  - Warnings and risk categories
  - Metadata useful for UX (what the user is actually doing)

### 🎯 Apply / Decision — `/api/apply`

- **Method:** `POST`
- **Purpose:** Take a scan/simulation result and apply rules (e.g. block/allow, require warnings, log event).
- **Notes:**
  - Designed to be idempotent and safe to call from wallets or backend services.

### 🧱 Token Intelligence — `/api/token/*`

Integrations with Bags public API to enrich the security context:

- `GET /api/token/:mint/creators` → list creators for a given token mint
- `GET /api/token/:mint/lifetime-fees` → aggregate lifetime fees collected, in lamports and SOL

These endpoints are used to power risk badges and metadata in the Bags Shield app.

### 🤝 Bags Launch Integration — `/api/bags/create-config`

- **Method:** `POST`
- **Purpose:** Proxy to Bags `token-launch/create-config` endpoint.
- **Input:**
  - `launchWallet` (required, Solana public key)
  - `tipWallet?`, `tipLamports?` (optional, tips to a vault)
- **Output:**
  - `tx`: base64-encoded transaction to be signed by the wallet
  - `configKey`: Bags launch configuration key
- **Behavior:**
  - Validates inputs (e.g. wallet length, non-empty body)
  - Adds `x-api-key` and `Authorization: Bearer ...` using `BAGS_API_KEY`
  - Normalizes upstream errors into the `{ success, error, meta }` envelope

---

## Tech Stack

**Languages & Runtime**

- TypeScript
- Node.js 20 (serverless on Vercel)

**Platform & Infra**

- Vercel Functions (`@vercel/node`)
- Vercel Dev / `vercel dev` for local emulation
- Environment variables managed via `vercel env`

**Validation & Testing**

- AJV (JSON Schema) for v0 contracts (`/api/v0/scan`, `/api/v0/simulate`)
- Newman collections for smoke testing:
  - `npm run test:prod`
  - `npm run test:local`
  - `npm run smoke` (both)

**Ecosystem Integrations**

- Bags public API v2 (`https://public-api-v2.bags.fm/api/v1/`)
- Solana wallets (via generated `tx` to be signed by Phantom/Backpack/etc.)
- Future: direct on-chain modules (Rust/Anchor) as a separate repository

---

## API Design & Conventions

All JSON responses follow the same envelope:

```json
{
  "success": true,
  "response": {},
  "error": {},
  "meta": {
    "requestId": "uuid-or-random-id",
    "upstream": "bags|internal|mock",
    "upstreamStatus": 200,
    "elapsedMs": 1234
  }
}
