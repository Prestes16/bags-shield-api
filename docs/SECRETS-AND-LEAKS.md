# Secrets And Leak Hygiene

Last updated: 2026-05-21

This document records the local secret-hygiene policy for Bags Shield. It covers API keys, RPC URLs, wallet/private keys, signing certificates, build artifacts, and client/server separation.

## Never Commit

Do not commit:

- `.env`, `.env.local`, `.env.*.local`, `.env.production`, `.env.development`
- API keys, bearer tokens, RPC URLs with `api-key=`, OAuth secrets, HMAC secrets
- Private keys, wallet keypairs, seed phrases, keystores, certificates
- Android signing files: `*.keystore`, `*.jks`, `*.p12`, `*.pfx`
- Any file named like `credentials.json`, `token.json`, `id_rsa`, `private-key.*`

Only `.env.example` should be committed, and it must contain placeholders or public addresses only.

## Server-Only Variables

These must stay backend-only and must not use `NEXT_PUBLIC_`, `REACT_APP_`, or any frontend prefix:

- `BAGS_API_KEY`
- `BAGS_BEARER`
- `HELIUS_API_KEY`
- `HELIUS_RPC_URL`
- `SOLANA_RPC_URL` if it contains a private provider key
- `BIRDEYE_API_KEY`
- `SCAN_HMAC_SECRET`
- `LAUNCHPAD_HMAC_SECRET`
- `INTEGRATION_SECRET`
- `VERCEL_TOKEN`
- `JUPITER_API_KEY`

Public wallet addresses are allowed in code/docs when needed for transparency, for example the Bags Shield treasury wallet.

## Current Jupiter Security Model

Swap/Jupiter fees use server-side configuration:

- `JUPITER_API_KEY` is read only in backend routes/providers.
- The frontend never receives the key.
- `/api/order` fails closed when swap fees are enabled but `JUPITER_API_KEY` or `JUPITER_REFERRAL_ACCOUNT` is missing.
- `/api/order` must not create a signable transaction if the expected referral fee is not applied.

## 2026-05-21 Hygiene Actions

- Removed tracked Android signing material from the working tree: `android.keystore`.
- Added keystore/certificate patterns to `.gitignore`.
- Replaced the local absolute keystore path in `twa-manifest.json` with a non-secret placeholder.
- Hardened `scripts/check-secrets.sh` to block staged key material such as keystores and certificates.
- Confirmed the user-provided Jupiter key was not written to the repository.

## Findings Requiring Rotation

The following secrets were exposed in chat/log text, not committed by this audit:

- A Jupiter API key.
- A Helius RPC URL containing an API key.
- A base58 wallet/private-key-like value used for setup commands.

Rotate these credentials before production use. Chat exposure should be treated as compromised even if the repository is clean.

## Local Checks Used

Use these checks before staging/pushing:

```powershell
rg -n "jup_[A-Za-z0-9_\\-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_\\-]{20,}|api-key=[A-Za-z0-9_\\-]{12,}|PRIVATE_KEY\\s*=|BAGS_API_KEY\\s*=|HELIUS_API_KEY\\s*=|BIRDEYE_API_KEY\\s*=|JUPITER_API_KEY\\s*=" C:\Dev\bags-shield-api C:\Dev\bags-shield-app2 --glob "!node_modules/**" --glob "!build/**" --glob "!.next/**" --glob "!frontend/build/**"
```

```powershell
git -c safe.directory=C:/Dev/bags-shield-api -C C:\Dev\bags-shield-api status --short
git -c safe.directory=C:/Dev/bags-shield-app2 -C C:\Dev\bags-shield-app2 status --short
```

## Push Checklist

- [ ] No `.env*` file is staged.
- [ ] No key/cert/keystore file is staged.
- [ ] No API key appears in docs, examples, logs, screenshots, or scripts.
- [ ] Frontend does not contain `BAGS_API_KEY`, `JUPITER_API_KEY`, `SOLANA_RPC_URL` with private key, or direct secret-bearing URLs.
- [ ] Backend validates missing secrets with fail-closed behavior.
- [ ] If any key appeared in chat/logs, rotate it before deploy.
