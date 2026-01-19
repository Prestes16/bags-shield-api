# Bags Shield API

Security gateway for **Solana** dApps and wallets - transaction analysis, risk simulation and integration with the **Bags** ecosystem.

**Bags Shield** sits between Solana dApps/wallets and raw transactions.
Before a user signs anything, the client can call this API and receive a clear, structured and traceable risk assessment.

---

## Overview

The API is designed to:

- Inspect transactions *before* they are sent on-chain;
- Simulate effects and return a **ShieldScore** (0-100) plus a risk grade (A-E);
- Query token creators and lifetime fees through the public **Bags** API;
- Help token creators bootstrap their launch configuration using Bags token-launch endpoints.

Besides being a real API, this repository also doubles as my **public Web3 portfolio**,
showing hands-on experience with:

- Solana integrations;
- Security-oriented API design;
- Modern serverless infrastructure on **Vercel**.

---

## Project status

- **Stage:** early alpha (actively evolving)
- **Network:** Solana (Bags ecosystem + token launches)
- **Infra:** Vercel Functions (Hobby plan, Node.js 20)

### Observações (Release Candidate)

- **Imports ESM ajustados para Node 20 no Vercel** (sem `ERR_MODULE_NOT_FOUND`).
- **`/api/scan` estável**: retorna 200 (válido) ou 400 (inválido). Não deve dar 404/500 em uso normal.
- **`app.html` redireciona para `/app-v4.html`** e está em UTF-8 (sem mojibake).
- **UI v4 completa**: views + ações conectadas (mesmo com stubs quando faltam chaves).
- **Graceful handling**: rotas dependentes de API keys retornam 501 com mensagem clara (sem stacktrace).
- **Segurança básica**: validação de payload, no-store, sem vazamento de erro interno.

---

## Core endpoints

### Transaction scan - `POST /api/scan`

Validate and score raw transaction data *before* broadcasting it to the network.

Returns, among other fields:

- `shieldScore` (0-100);
- Risk `grade` (A-E);
- Risk indicators (for example: liquidity, ownership, minting risks);
- `isSafe` flag plus human-readable explanations.

---

### Transaction simulation - `POST /api/simulate`

Simulate the effect of a transaction and estimate the risk/impact of what the user is actually doing.

Typical output:

- `shieldScore` focused on the impact of the action;
- Warnings and risk categories;
- Helpful metadata for UX (for example: "swap", "add liquidity", "mint", etc.).

---

### Apply / decision - `POST /api/apply`

Takes the result of a scan/simulation and applies decision rules, such as:

- block / allow;
- require extra confirmation;
- log events for audit/compliance.

This endpoint is designed to be **idempotent** and safe to call from both wallets and backend services.

---

## Token intelligence - `/api/token/*`

Integration with the public **Bags** API to enrich security context:

- `GET /api/token/:mint/creators` - list creators for a given mint;
- `GET /api/token/:mint/lifetime-fees` - return total lifetime fees for a token (in lamports and SOL).

These endpoints feed risk indicators and metadata in the Bags Shield app.

---

## Bags launch integration - `POST /api/bags/create-config`

Proxy to Bags `token-launch/create-config`.

**Request example:**

```json
{
  "launchWallet": "RequiredSolanaPubkey",
  "tipWallet": "OptionalTipPubkey",
  "tipLamports": 1000000
}
```

**Response (simplified):**

```json
{
  "success": true,
  "response": {
    "configKey": "BagsConfigPubkey",
    "tx": "Base64EncodedTransactionToSignOrNull"
  },
  "meta": {
    "requestId": "example-id",
    "upstream": "bags",
    "upstreamStatus": 200,
    "elapsedMs": 1234
  }
}
```

Behavior:

- Validates input (for example: public key format, non-empty body);
- Injects `x-api-key` and `Authorization: Bearer ...` using `BAGS_API_KEY`;
- Normalizes upstream Bags errors into the common `{ success, error, meta }` envelope.

---

## Tech stack

### Language and runtime

- TypeScript;
- Node.js 20 (serverless on Vercel).

### Platform

- Vercel Functions (`@vercel/node`);
- `vercel dev` for local emulation;
- Environment variables managed via `vercel env`.

### Validation and testing

- **AJV (JSON Schema)** for v0 contracts (`/api/v0/scan`, `/api/v0/simulate`);
- **Newman** smoke test collections:
  - `npm run test:prod`;
  - `npm run test:local`;
  - `npm run smoke` (runs both).

### Ecosystem integrations

- Bags public API v2 (`https://public-api-v2.bags.fm/api/v1/`);
- Solana wallets (generates `tx` to be signed by Phantom, Backpack, etc.);
- Future: on-chain modules (Rust/Anchor) as a separate repository.

---

## API response contract

All JSON responses follow the same shape:

```json
{
  "success": true,
  "response": {},
  "error": {},
  "meta": {
    "requestId": "uuid-or-random-id",
    "upstream": "bags | internal | mock",
    "upstreamStatus": 200,
    "elapsedMs": 1234
  }
}
```

- `success`: high-level success/error flag;
- `response`: business payload for the route;
- `error`: details when something goes wrong (message, type, etc.);
- `meta`: always includes `requestId` for tracing, plus information about the upstream source and timing.

---

## Why this repo exists

This repository exists for two main reasons:

1. **Real security infra** for Solana dApps and wallets;
2. **Public proof of experience** with:
   - risk- and security-oriented API design;
   - Bags ecosystem integrations;
   - modern serverless architecture on Vercel.

If you are building on Solana and want to integrate Bags Shield or discuss ideas around memecoin security and risk tooling, feel free to open an issue or fork the project.
