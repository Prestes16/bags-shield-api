# Smoke Checks e Envs

## Variáveis (server-only)

- **`BAGS_SHIELD_API_BASE`** – Base URL do backend Bags Shield (para proxy). Quando definido, `/api/scan` e `/api/market/summary` fazem proxy. **Nunca** usar `NEXT_PUBLIC_` para esta chave.
- **`HELIUS_API_KEY`** – Chave da Helius (RPC e APIs). Usada para scan e RPC. **Nunca** usar `NEXT_PUBLIC_`. O scan retorna 501 se ausente/inválida.

## Reiniciar dev para carregar env

```bash
# Parar o dev (Ctrl+C) e rodar de novo
pnpm dev
```

O Next.js lê `.env` e `.env.local` no início. Alterações exigem reinício.

## Smoke local

```powershell
# Com dev rodando em outro terminal (pnpm dev)
powershell -ExecutionPolicy Bypass -File scripts/smoke-local.ps1
```

Ou com base customizada:

```powershell
$env:BASE_URL = "http://localhost:3000"
.\scripts\smoke-local.ps1
```

### Endpoints testados

1. `GET /api/market/summary?mint=So111...` – 200 ou 502 (proxy)
2. `GET /api/status` – 200
3. `GET /api/rpc/health` – 200
4. `POST /api/scan` – 200 (ok), 501 (Helius não configurado), 401 (chave inválida), 403 (restrito), 502 (upstream)
