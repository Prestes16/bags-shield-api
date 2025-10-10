# Bags Shield API â€” v1.2.0

Camada de confianÃ§a para o ecossistema Bags. Endpoints HTTP (serverless) com CORS unificado e avaliaÃ§Ã£o de risco simples.

## ðŸš€ Como rodar local
```bash
npx vercel dev --listen 3000
```
Base local: `http://localhost:3000`

Smoke test (PowerShell):
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke.ps1
```

## ðŸ”Œ Endpoints

### GET `/api/health`
Retorna status da API.
```bash
curl -s http://localhost:3000/api/health | jq
```

### GET/POST `/api/scan`
Analisa parÃ¢metros bÃ¡sicos e retorna um `risk` (score/label/badges).

**Body (JSON):**
```json
{
  "network": "devnet | mainnet",
  "mint": "Base58 da mint"
}
```

**Exemplo:**
```bash
curl -s -X POST http://localhost:3000/api/scan   -H "Content-Type: application/json"   -d '{"network":"devnet","mint":"So11111111111111111111111111111111111111112"}' | jq
```

### GET/POST `/api/simulate`
Simula uma operaÃ§Ã£o e retorna eco dos dados + `risk`.

**Body (JSON):**
```json
{
  "network": "devnet | mainnet",
  "mint": "Base58 da mint",
  "amount": 1.5,
  "slippageBps": 50
}
```

**Exemplo:**
```bash
curl -s -X POST http://localhost:3000/api/simulate   -H "Content-Type: application/json"   -d '{"network":"devnet","mint":"So11111111111111111111111111111111111111112","amount":1.5,"slippageBps":50}' | jq
```

### POST `/api/apply`
Aplica a simulaÃ§Ã£o (mock) e retorna eco + `risk`.

**Exemplo:**
```bash
curl -s -X POST http://localhost:3000/api/apply   -H "Content-Type: application/json"   -d '{"network":"devnet","mint":"So11111111111111111111111111111111111111112","amount":1.5,"slippageBps":50}' | jq
```

## ðŸ§  Sobre o `risk`
Resposta inclui:
```json
{
  "risk": {
    "score": 20,
    "label": "LOW",
    "reasons": ["..."],
    "badges": [
      { "id": "low-risk", "color": "green", "text": "Baixo risco" }
    ]
  }
}
```

Regras v2 atualmente consideram:
- `network`: `devnet` (+risco), `mainnet` (âˆ’risco), ausente/desconhecida (+risco)
- `mint`: validaÃ§Ã£o base58/length e casos conhecidos (ex.: Wrapped SOL)

## ðŸ”’ CORS / Cache
- `Access-Control-Allow-Origin: *`
- PrÃ©-flight `OPTIONS` com `204`
- `Cache-Control: no-store`

---
MIT Â© Bags Shield

