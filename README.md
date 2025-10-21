# Bags Shield API

**PROD (alias):** https://bags-shield-api.vercel.app  
**PROJETO:** https://bags-shield-api-prestes16.vercel.app

## Setup rápido
1. Copie o exemplo:
```bash
cp .env.example .env
```
2. Preencha (NÃO comitar segredos): BAGS_BEARER, ALLOWED_ORIGINS; e quando usar integrações, BAGS_API_KEY, SOLANA_RPC_URL.

## Checks rápidos
- `/api/health` deve retornar **200** com headers:
  - `X-Request-Id`
  - `Access-Control-Expose-Headers: X-Request-Id`
- No corpo: `meta.requestId`.

## Deploy (PROD)
```bash
npx -y vercel@latest deploy --prod
npx -y vercel@latest alias set https://bags-shield-api-prestes16.vercel.app bags-shield-api.vercel.app
```

## Smokes diários
- Script: `scripts/morning-smokes.ps1` (logs em `./logs/smoke-*.txt`)
- Tarefa agendada: **BagsShield Morning Smokes** — 09:15 local.

## Higiene
- `.gitignore` ignora `logs/`, `tmp/`, `.env*`, `.bak/.tmp`.
- `.vercelignore` evita enviar tralha/mocks no build.

## Dica de console (acentos)
```powershell
chcp 65001 > $null
[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8
```
