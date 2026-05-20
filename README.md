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

### Current source of truth

For the current product state, roadmap and security language, use:

- [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)
- [docs/ROADMAP_TRANSPARENTE.md](docs/ROADMAP_TRANSPARENTE.md)
- [docs/SECURITY_TRANSPARENCY.md](docs/SECURITY_TRANSPARENCY.md)

Do not use older claims such as "100% ready", "unique on Solana" or fixed route counts without checking those documents first.

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

### Apply / decision - roadmap

Takes the result of a scan/simulation and applies decision rules, such as:

- block / allow;
- require extra confirmation;
- log events for audit/compliance.

This is a roadmap capability. Do not document `/api/apply` as a current production route unless it exists in `src/app/api`.

---

## Token intelligence - Bags API routes

Integration with the public **Bags** API to enrich security context:

- Launchpad and fee-claim routes call Bags server-side where implemented.
- Some older `/api/token/*` examples are historical and should be verified against `src/app/api` before use.

These endpoints feed risk indicators and metadata in the Bags Shield app.

---

## Bags launch integration - Launchpad beta

The active Launchpad beta uses routes under `/api/launchpad/*`, including token info, fee quote, create config, create launch transaction and send. The flow is implemented locally but still needs controlled real Bags validation before production-ready claims.

**Request example:**

```json
{
  "payer": "CreatorSolanaPubkey",
  "baseMint": "TokenMint",
  "claimersArray": ["CreatorSolanaPubkey"],
  "basisPointsArray": [10000]
}
```

**Response (simplified):**

```json
{
  "success": true,
  "response": {
    "configKey": "BagsConfigPubkey"
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
- Injects `x-api-key` server-side using `BAGS_API_KEY`;
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

## Security posture (transparency-first)

Bags Shield is built with a **fail-closed** mindset: if data cannot be trusted, we degrade clearly instead of guessing.

### Trust model
- **Client is untrusted.** The app UI never "decides" risk.
- **Server computes risk outputs.** Scores/badges are generated server-side.
- **Integrity markers** are attached to scan results to reduce forgery and replay risk.
- If upstream sources fail, we return **explicitly degraded** results.

### Anti-abuse & hardening
- Strict request validation (schema-based, unknown keys rejected)
- Request size limits + content-type enforcement
- Rate-limiting by IP (and optional keys when enabled)
- No-store responses + requestId correlation for debugging
- Logs are sanitized (secrets never logged)

### Known limitations (honesty)
> We do not claim "anti-scam guarantee".
> Bags Shield is a risk intelligence layer: it helps users decide faster with better signals.
> Safety is probabilistic; we continuously harden defenses and publish changes.
> Bags Shield verifies native protocol LP lock when evidence exists; it does not execute LP lock.

### Responsible disclosure
See [SECURITY.md](./SECURITY.md).

**Additional documentation:**
- [docs/security.md](docs/security.md)
- [docs/threat-model.md](docs/threat-model.md)
- [CHANGELOG.md](CHANGELOG.md)

---

## Why this repo exists

This repository exists for two main reasons:

1. **Real security infra** for Solana dApps and wallets;
2. **Public proof of experience** with:
   - risk- and security-oriented API design;
   - Bags ecosystem integrations;
   - modern serverless architecture on Vercel.

If you are building on Solana and want to integrate Bags Shield or discuss ideas around memecoin security and risk tooling, feel free to open an issue or fork the project.
