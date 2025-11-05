# Bags Shield API

**PROD (alias):** https://bags-shield-api.vercel.app  
**PROJETO:** https://bags-shield-api-prestes16.vercel.app

## Setup rÃƒÂ¡pido
1. Copie o exemplo:
```bash
cp .env.example .env
```
2. Preencha (NÃƒÆ’O comitar segredos): BAGS_BEARER, ALLOWED_ORIGINS; e quando usar integraÃƒÂ§ÃƒÂµes, BAGS_API_KEY, SOLANA_RPC_URL.

## Checks rÃƒÂ¡pidos
- `/api/health` deve retornar **200** com headers:
  - `X-Request-Id`
  - `Access-Control-Expose-Headers: X-Request-Id`
- No corpo: `meta.requestId`.

## Deploy (PROD)
```bash
npx -y vercel@latest deploy --prod
npx -y vercel@latest alias set https://bags-shield-api-prestes16.vercel.app bags-shield-api.vercel.app
```

## Smokes diÃƒÂ¡rios
- Script: `scripts/morning-smokes.ps1` (logs em `./logs/smoke-*.txt`)
- Tarefa agendada: **BagsShield Morning Smokes** Ã¢â‚¬â€ 09:15 local.

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
## Release v0 (mock) â€” Checklist

**Estado**: mock (controlado por env).  
**Docs**: docs/api-v0.md â€¢ **Collection**: docs/postman/bags-shield-api-v0.postman_collection.json

### 1) VariÃ¡veis de ambiente
- BAGS_API_BASE âœ… (ex.: https://public-api-v2.bags.fm/api/v1/)
- BAGS_API_KEY âœ… (presente no ambiente)
- BAGS_SCAN_MODE = mock (prod/preview/dev)
- BAGS_SIM_MODE  = mock (prod/preview/dev)

**Debug em produÃ§Ã£o**
- GET /api/debug/env-bags â†’ mostra BAGS_API_BASE
- GET /api/debug/env-bags-key â†’ { present: true, masked: "bag***" }
- GET /api/debug/env-modes â†’ { BAGS_SCAN_MODE: "mock", BAGS_SIM_MODE: "mock" }

### 2) Smokes (produÃ§Ã£o)
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
POST /api/scan â†’ { rawTransaction: base64 }

POST /api/simulate â†’ { mint: base58 }
Envelope padrÃ£o:
{ success: boolean, response|error, meta:{ requestId, mode } }

5) Observabilidade
Header X-Request-Id exposto (Access-Control-Expose-Headers)

Cache-Control: no-store em rotas debug e handlers v0

PrÃ³ximos marcos: implementar modo real (501 hoje), documentar auth/limites, e preparar rollout controlado (Rolling Releases) quando migrarmos do mock.

<!-- BAGS_SHIELD_RELEASE_V0_END -->r


<!-- BAGS_SHIELD_ROADMAP_V02_START -->
## Roadmap v0.2.0 (real) — NEXT

### Objetivo
Ativar **modo real** em scan e simulate, integrando a Bags API com timeouts, backoff e observabilidade.

### Tarefas
- [ ] lib/bags.ts: agsFetch (x-api-key + Bearer), timeout 5000ms, retries exponenciais (429/5xx), repassar X-RateLimit-*.
- [ ] /api/scan (real): validar schema v0, chamar upstream, mapear 2xx/4xx/5xx para envelope { success:false|true, ... }.
- [ ] /api/simulate (real): idem acima.
- [ ] **Segurança**: nunca logar chaves; sanitizar mensagens de erro.
- [ ] **Observabilidade**: X-Request-Id, Cache-Control: no-store, logs estruturados, meta.rate com limites.
- [ ] **Toggles**: BAGS_SCAN_MODE=real, BAGS_SIM_MODE=real em **Preview** (canário).
- [ ] **Docs/Collection**: atualizar exemplos “real”; adicionar testes de 401/429.
- [ ] **CI (opcional)**: workflow Newman para Production e Local (mock).
- [ ] **Rollout**: Rolling Releases 5%→25%→100% + Skew Protection habilitado.

### Critério de aceite
- Smokes “prod (real)” e “local (AJV)” verdes.
- Sem vazamento de segredo em logs/headers.
<!-- BAGS_SHIELD_ROADMAP_V02_END -->
