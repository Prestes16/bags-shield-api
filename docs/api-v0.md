# Bags Shield — API v0

Estado: **mock** (controlado por env).  
Schemas: `schemas/v0/scan.*.json`, `schemas/v0/simulate.*.json`.  
Dev-server AJV: `npm run dev-v0` (padrão porta **8787**).

## Base URLs
- Produção: `https://bags-shield-api-4.vercel.app`
- Local (dev): `http://127.0.0.1:8787`

## Headers
Content-Type: application/json
Accept: application/json

markdown
Copiar código

## Status
- 200 — sucesso (`success: true`)
- 400 — validação (AJV/handler)
- 405 — método inválido
- 501 — modo `real` ainda não implementado
- 204 — preflight CORS (OPTIONS)

## Env toggles
- `BAGS_SCAN_MODE`: `mock` (default) | `real` (501)
- `BAGS_SIM_MODE`:  `mock` (default) | `real` (501)
- `BAGS_API_BASE`:  base upstream (apenas informativo em `metadata.base`)
- `BAGS_API_KEY`:   presente no ambiente (não exibida)

---

## POST /api/scan

### Request
```json
{ "rawTransaction": "AQAAAAAAAAAAAAAA" }
Response (exemplo real)
json
Copiar código
{
  "success": true,
  "response": {
    "isSafe": false,
    "shieldScore": 66,
    "grade": "C",
    "warnings": ["short_base64_input"],
    "metadata": {
      "mode": "mock",
      "rawLength": 16,
      "base": "https://public-api-v2.bags.fm/api/v1/"
    }
  },
  "meta": { "requestId": "req_xxxxxx", "mode": "mock" }
}
curl (prod)
bash
Copiar código
curl -sS -X POST https://bags-shield-api-4.vercel.app/api/scan \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{ "rawTransaction": "AQAAAAAAAAAAAAAA" }'
PowerShell (local)
powershell
Copiar código
$h = @{ 'Content-Type'='application/json'; 'Accept'='application/json' }
$body = @{ rawTransaction='AQAAAAAAAAAAAAAA' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/v0/scan' -Method Post -Headers $h -Body $body
POST /api/simulate
Request
json
Copiar código
{ "mint": "So11111111111111111111111111111111111111112" }
Response (exemplo real)
json
Copiar código
{
  "success": true,
  "response": {
    "isSafe": false,
    "shieldScore": 25,
    "grade": "E",
    "warnings": [],
    "metadata": {
      "mode": "mock",
      "mintLength": 43,
      "base": "https://public-api-v2.bags.fm/api/v1/"
    }
  },
  "meta": { "requestId": "req_xxxxxx", "mode": "mock" }
}
curl (prod)
bash
Copiar código
curl -sS -X POST https://bags-shield-api-4.vercel.app/api/simulate \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{ "mint": "So11111111111111111111111111111111111111112" }'
PowerShell (local)
powershell
Copiar código
$h = @{ 'Content-Type'='application/json'; 'Accept'='application/json' }
$body = @{ mint='So11111111111111111111111111111111111111112' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/v0/simulate' -Method Post -Headers $h -Body $body
Dev-server AJV
Arquivo: scripts/dev-server.cjs

Rotas: POST /api/v0/scan, POST /api/v0/simulate

Rodar:

bash
Copiar código
npm run dev-v0
# ou
PORT=8888 npm run dev-v0
Debug
GET /api/debug/env-bags

GET /api/debug/env-bags-key

GET /api/debug/env-modes