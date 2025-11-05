# Bags Shield API

**PROD (alias):** https://bags-shield-api.vercel.app  
**PROJETO:** https://bags-shield-api-prestes16.vercel.app

## Setup rÃ¡pido
1. Copie o exemplo:
```bash
cp .env.example .env
```
2. Preencha (NÃƒO comitar segredos): BAGS_BEARER, ALLOWED_ORIGINS; e quando usar integraÃ§Ãµes, BAGS_API_KEY, SOLANA_RPC_URL.

## Checks rÃ¡pidos
- `/api/health` deve retornar **200** com headers:
  - `X-Request-Id`
  - `Access-Control-Expose-Headers: X-Request-Id`
- No corpo: `meta.requestId`.

## Deploy (PROD)
```bash
npx -y vercel@latest deploy --prod
npx -y vercel@latest alias set https://bags-shield-api-prestes16.vercel.app bags-shield-api.vercel.app
```

## Smokes diÃ¡rios
- Script: `scripts/morning-smokes.ps1` (logs em `./logs/smoke-*.txt`)
- Tarefa agendada: **BagsShield Morning Smokes** â€” 09:15 local.

## Higiene
- `.gitignore` ignora `logs/`, `tmp/`, `.env*`, `.bak/.tmp`.
- `.vercelignore` evita enviar tralha/mocks no build.

## Dica de console (acentos)
```powershell
chcp 65001 > $null
[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8
```

redeploy 2025-11-04 18:20:20
rnrn<!-- BAGS_SHIELD_RELEASE_V0_START -->
## Release v0 (mock) — Checklist

**Estado**: mock (controlado por env).  
**Docs**: docs/api-v0.md • **Collection**: docs/postman/bags-shield-api-v0.postman_collection.json

### 1) Variáveis de ambiente
- BAGS_API_BASE ✅ (ex.: https://public-api-v2.bags.fm/api/v1/)
- BAGS_API_KEY ✅ (presente no ambiente)
- BAGS_SCAN_MODE = mock (prod/preview/dev)
- BAGS_SIM_MODE  = mock (prod/preview/dev)

**Debug em produção**
- GET /api/debug/env-bags → mostra BAGS_API_BASE
- GET /api/debug/env-bags-key → { present: true, masked: "bag***" }
- GET /api/debug/env-modes → { BAGS_SCAN_MODE: "mock", BAGS_SIM_MODE: "mock" }

### 2) Smokes (produção)
`ash
curl -sS -X POST https://bags-shield-api-4.vercel.app/api/scan \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{ "rawTransaction": "AQAAAAAAAAAAAAAA" }'

curl -sS -X POST https://bags-shield-api-4.vercel.app/api/simulate \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{ "mint": "So11111111111111111111111111111111111111112" }'
Retorno esperado: success: true e meta.mode: "mock".

3) Testes automatizados (Newman)
Prod: npm run test:prod

Local (AJV, precisa do dev-server):

subir: PORT=8888 npm run dev-v0

testar: npm run test:local

Tudo: npm run test:all

4) Endpoints v0 (mock)
POST /api/scan → { rawTransaction: base64 }

POST /api/simulate → { mint: base58 }
Envelope padrão:
{ success: boolean, response|error, meta:{ requestId, mode } }

5) Observabilidade
Header X-Request-Id exposto (Access-Control-Expose-Headers)

Cache-Control: no-store em rotas debug e handlers v0

Próximos marcos: implementar modo real (501 hoje), documentar auth/limites, e preparar rollout controlado (Rolling Releases) quando migrarmos do mock.

<!-- BAGS_SHIELD_RELEASE_V0_END -->r
