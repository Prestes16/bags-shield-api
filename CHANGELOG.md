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

## [0.2.0-mock](https://github.com/Prestes16/bags-shield-api/compare/v0.1.0-mock...v0.2.0-mock) (2026-01-16)


### Features

* add project improvements and tooling ([cf65a34](https://github.com/Prestes16/bags-shield-api/commit/cf65a349712f2fa80cd19a7dc271845a53549996))
* **api:** /api/bags/ping usa bagsJson (timeout+retries/backoff), status HTTP real e X-Request-Id ([fb6580a](https://github.com/Prestes16/bags-shield-api/commit/fb6580aaa4d304dac6e57f8945d0c70b4b16c22c))
* **api:** /scan com validação base64 e /simulate com base58; headers no-store + X-Request-Id; OPTIONS ([6feb51f](https://github.com/Prestes16/bags-shield-api/commit/6feb51fbb85517fd9c1d9e0691b1e738480cf1a0))
* **api:** add /apply com CORS/preflight, X-Request-Id e no-store (envelope padronizado) ([64a2e3f](https://github.com/Prestes16/bags-shield-api/commit/64a2e3faab318a82eb38df27455cf8aca2231d2d))
* **api:** harden handlers + webhook + bags adapter ([0edd387](https://github.com/Prestes16/bags-shield-api/commit/0edd387544845c4f47b4860991c02175bdfccc28))
* **api:** POST /api/bags/create-config (proxy, validações base58, CORS/no-store, envelope padrão) ([855a84a](https://github.com/Prestes16/bags-shield-api/commit/855a84a2323e0a17dff5c0512c19ea1c06eb70ea))
* **api:** POST /api/bags/token-info (proxy create-token-info via bagsJson, CORS/no-store, envelope padrão) ([be02657](https://github.com/Prestes16/bags-shield-api/commit/be026572255c41f462e6d9bfb1004fc608237c0a))
* **bags:** adapter Bags, ping de config e console de status ([5965415](https://github.com/Prestes16/bags-shield-api/commit/59654155d7c1e09c1bc45157e855faef37670d6a))
* **bags:** add claim-txs proxy (strict validation + upstream passthrough) ([bd1ec92](https://github.com/Prestes16/bags-shield-api/commit/bd1ec9224d5d92b99887ccf09cd2c1c0585f7627))
* **bags:** add claimable-positions proxy (wallet -&gt; fee vaults) ([eabd1ae](https://github.com/Prestes16/bags-shield-api/commit/eabd1ae928caa7bdeddbcece1be1982ef269f96c))
* **bags:** add pool-config proxy + smoke script ([5489918](https://github.com/Prestes16/bags-shield-api/commit/54899187196c4468e840239cb7a2ef8dc3cf5dcf))
* **bags:** add token-info proxy + smoke scripts ([704b914](https://github.com/Prestes16/bags-shield-api/commit/704b91423d9fb438c5f216939b461c51375ee8f0))
* **bags:** adiciona /api/bags/ping stub e limpa vercel.json ([96cf40c](https://github.com/Prestes16/bags-shield-api/commit/96cf40cc990e2d4ed9c7ff92f8ed8465a6a38e9f))
* **bags:** adiciona endpoint /api/bags/create-config ([3cd0a61](https://github.com/Prestes16/bags-shield-api/commit/3cd0a61bd86e7b6dd10805619a934f49b9162151))
* **bags:** harden create-config proxy + smoke script ([e2be3c3](https://github.com/Prestes16/bags-shield-api/commit/e2be3c3398c1617dc2be2254115f6592b6f6d419))
* **bags:** rota /api/bags/token-info integrada ao create-token-info ([bfed8e7](https://github.com/Prestes16/bags-shield-api/commit/bfed8e7001e10a749b5a1c40bd50739f455b8507))
* **diag:** /api/bags/_diag (flags de runtime sem segredos) + no-store/CORS ([a1794db](https://github.com/Prestes16/bags-shield-api/commit/a1794db72e8ca6521050bab13a6e04a377193f6c))
* **health:** cria /api/health com HEAD/GET, CORS básico, no-store e X-Request-Id ([489bf8c](https://github.com/Prestes16/bags-shield-api/commit/489bf8c4305112437a54e1374f38637eee8461eb))
* **http:** lib/bags.ts com bagsFetch (timeout+retries/backoff) e bagsJson {success,response|error,meta} ([5476cdc](https://github.com/Prestes16/bags-shield-api/commit/5476cdc6e64b48ff810b257270c192ce747bd062))
* **landing:** +Andamento do Projeto e card de Deploy & Metadados ([e861f6d](https://github.com/Prestes16/bags-shield-api/commit/e861f6d31e97f3c467c2f6d6f9f57e0a87af395e))
* **landing:** logo escudo+$, chuva de $ em background, checagem inteligente de /scan e /simulate; donut soma todos ([dfaf919](https://github.com/Prestes16/bags-shield-api/commit/dfaf919fe1ac86dc869d9405d93c75f559706964))
* **landing:** logo escudo+$, chuva de $ em background, checagem inteligente de /scan e /simulate; donut soma todos ([6e3cf79](https://github.com/Prestes16/bags-shield-api/commit/6e3cf79d4ad53b4e7b4c8f89a0a79aef2a9b6ea2))
* **landing:** logo SVG inline (shield+bag), hover lift e tilt suave; mantém CTAs azuis e animações ([b43fd15](https://github.com/Prestes16/bags-shield-api/commit/b43fd15245eefc57039eccbc10798ad6e5b9c234))
* **landing:** Painel de Confiabilidade (donut+barras), auto-refresh e Nota de Segurança ([86d307b](https://github.com/Prestes16/bags-shield-api/commit/86d307bc585b1712c3791688e04926e1d0cf375f))
* **landing:** tema navy/azul + hero + status/mini playground ([f373f7c](https://github.com/Prestes16/bags-shield-api/commit/f373f7c9854e97627cbc98d466d2e679b375ed43))
* **mock:** add /api/apply + preflight; validação forte em /api/scan (base64) e /api/simulate (base58); headers no-store + X-Request-Id ([d5105d1](https://github.com/Prestes16/bags-shield-api/commit/d5105d1fbde448e1a96116015c4ec25e34d09709))
* **pwa:** add manifest and restore app UI ([a99a07f](https://github.com/Prestes16/bags-shield-api/commit/a99a07f4bca5b14844c06129aefc1c939ba59d03))
* **pwa:** add proper icons + twa manifest start_url ([9b472bc](https://github.com/Prestes16/bags-shield-api/commit/9b472bc97270e61186746b4fa97027cc1b6a1f79))
* **pwa:** update icons and enhance TWA manifest configuration ([0accc37](https://github.com/Prestes16/bags-shield-api/commit/0accc378bb9d34c29c53a6235a78530c42e2fb54))
* **ui:** add mobile app dashboard (app.html) and link from status ([2f75201](https://github.com/Prestes16/bags-shield-api/commit/2f75201f3dcfc581f0be49b7b6620c26df224234))
* **ui:** add polished status dashboard ([8f14340](https://github.com/Prestes16/bags-shield-api/commit/8f14340e5480d01752774380e9b1230336a316dc))
* **ui:** finaliza app.html (glow+glass) e actions Health/Scan/Simulate ([76a4406](https://github.com/Prestes16/bags-shield-api/commit/76a4406970ac28690e4c690cffe611760ba350be))
* **ui:** implement app.css and app.js for app dashboard ([1808855](https://github.com/Prestes16/bags-shield-api/commit/1808855acfacbd1bd677f21f1d6102d120cb69f6))
* **ui:** modal acessível 'Nota de segurança' (conteúdo completo + foco/esc/overlay) — sem alert() e sem regex frágil ([acececb](https://github.com/Prestes16/bags-shield-api/commit/acececb65ceb0114d593e403b29291eaa557f831))
* **ui:** show Vercel response headers on status dashboard ([ef24814](https://github.com/Prestes16/bags-shield-api/commit/ef2481495a83bf7440e6f2935e12cb6afb7ce354))
* **ui:** splash+home+report (mock navy) + connect wallet modal + v0 simulate call ([3ae86f6](https://github.com/Prestes16/bags-shield-api/commit/3ae86f6f94b6e780d9c86a966e12f345fa869984))
* **ui:** suporte inicial a multi-idioma no status playground ([1914715](https://github.com/Prestes16/bags-shield-api/commit/19147156d72aa1da14374ab00da62f07f80c6dd2))


### Bug Fixes

* **api:** fix esm module type and cors extension in ping.ts ([3a99a4f](https://github.com/Prestes16/bags-shield-api/commit/3a99a4fb3a7570dcd72f17466dce7db62740775c))
* **api:** force recreate ping.ts with absolute path ([b544494](https://github.com/Prestes16/bags-shield-api/commit/b5444940e6e3d3a7fb903356c92177893f87c786))
* **api:** mass fix ESM imports adding .js extensions ([0c3a214](https://github.com/Prestes16/bags-shield-api/commit/0c3a214895e25935533c3cf528d0891c436851b9))
* **api:** move scan.ts to correct folder api/bags ([94aff5a](https://github.com/Prestes16/bags-shield-api/commit/94aff5aabda97850a992008aef9484f76ed33adb))
* **bags:** ajusta ping adapter e token-info para BagsResult ([4b096ab](https://github.com/Prestes16/bags-shield-api/commit/4b096ab50340aa15c9a7f8c8a2f5360a32018af4))
* **cache:** force no-store for app shell (html/js/css/manifest) ([2827b5b](https://github.com/Prestes16/bags-shield-api/commit/2827b5be8ff2a2d385eef019fde58f7fa04a0ead))
* **cache:** no-store for app shell (twa) to avoid stale UI ([a0b22a1](https://github.com/Prestes16/bags-shield-api/commit/a0b22a1aa2bae0f572f73e9579b8a8738bf2d291))
* **landing:** corrige encoding UTF-8 (acentos) e adiciona fallback SVG para logo; mantém motions e CTAs azuis ([faa1446](https://github.com/Prestes16/bags-shield-api/commit/faa1446d10a7c7a97b6bde791cd5201d761423f3))
* **mock:** validação forte em /api/scan (base64) + /api/simulate com base58; CORS no-store e X-Request-Id; preflight OPTIONS ([1a7e2ca](https://github.com/Prestes16/bags-shield-api/commit/1a7e2cac93b5956d38b3f2cb65a87a3b0bfb2bba))
* **prod:** prevent serverless module-load crash on scan/simulate ([4ce5705](https://github.com/Prestes16/bags-shield-api/commit/4ce57056fc34709125f03aa357b8f8867120b37f))
* **scan:** versiona handler dev e alinha playground de status ([7ea4277](https://github.com/Prestes16/bags-shield-api/commit/7ea4277032e0eb5365d9279646d3f9b45d68b850))
* **smoke:** compat PowerShell 5.1 (sem ternario; fallback de host; strings ASCII) ([2d6017c](https://github.com/Prestes16/bags-shield-api/commit/2d6017cdbcdebad8bdfdd2d3aa850de324abee3f))
* **smoke:** PS 5.1 ASCII only (remove em dash), same logic ([e831408](https://github.com/Prestes16/bags-shield-api/commit/e831408151ca3a4aab3fbfb24c71b4133252da7d))
* **twa:** add digital asset links (assetlinks.json) ([24d872f](https://github.com/Prestes16/bags-shield-api/commit/24d872faedeacfd403c45278114ffdc4fdb84b6f))
* **twa:** corrige assetlinks.json (package+fingerprint) ([ada7696](https://github.com/Prestes16/bags-shield-api/commit/ada76966e4119c0467ac8b365ab4853634019b9c))
* **twa:** remove BOM de assetlinks.json ([d181799](https://github.com/Prestes16/bags-shield-api/commit/d1817995088b8e75d9135635031d075b27d85d8d))
* **ui:** add app.js (menu+i18n+wallet MWA/provider) + report badges + api v0 fallback ([f000728](https://github.com/Prestes16/bags-shield-api/commit/f000728b13c4a55522807601f08c82fcbd032829))
* **ui:** utf-8 + viewport + menu markers + ensure app.js module ([85de42d](https://github.com/Prestes16/bags-shield-api/commit/85de42d535a1a1c2a2d4d12d36fad27599357ff7))
* **vercel:** functions api/**/*.ts (nodejs20.x) + rotas para /public; garante !api/** no .vercelignore ([0c1ae11](https://github.com/Prestes16/bags-shield-api/commit/0c1ae11885346ea9885adab22d3f71ce656718f8))
* **vercel:** remove runtimes legados (now-php) e fixa nodejs20.x ([369c2a3](https://github.com/Prestes16/bags-shield-api/commit/369c2a338427dd1c5aa75301c616554c6d062db7))

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
