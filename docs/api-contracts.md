# Bags Shield API — Contratos (Beta)

## GET/POST `/api/scan`

### Request

- **GET:** `?mint=<base58>` (obrigatório). Opcionais: `amount`, `wallet`, `slippage`, `locale`, `referrer`.
- **POST:** Body JSON `{ "mint": "<base58>", "amount"?: number, "wallet"?: string, "slippage"?: number, "locale"?: "en"|"pt"|"es"|"fr", "referrer"?: string }`.
- Schema: Zod com `.strict()` — chaves desconhecidas rejeitadas.
- `mint`: 32–44 caracteres, base58 válido.

### Response 200 (canônico)

```json
{
  "success": true,
  "response": {
    "mint": "string",
    "score": 0,
    "badge": "SAFE | CAUTION | HIGH_RISK",
    "confidence": 0.0,
    "reasons": [
      {
        "code": "string",
        "title": "string",
        "detail": "string",
        "severity": "LOW | MEDIUM | HIGH",
        "evidence": {}
      }
    ],
    "signals": {
      "data_conflict": false,
      "sourcesOk": 0,
      "sourcesTotal": 0,
      "mintActive": null,
      "lpLockSeconds": null,
      "top10ConcentrationPercent": null,
      "sellTaxBps": null
    },
    "market": {
      "price": 0,
      "liquidity": 0,
      "volume24h": 0,
      "sourcesUsed": []
    },
    "pools": [
      {
        "type": "meteora | raydium | unknown",
        "address": "",
        "liquidity": 0,
        "lpLocked": null,
        "evidence": {}
      }
    ],
    "actors": {
      "botLikely": false,
      "washLikely": false,
      "notes": []
    },
    "ts": "ISO8601"
  },
  "meta": {
    "requestId": "string",
    "sources": [
      {
        "name": "helius",
        "ok": true,
        "latencyMs": 0,
        "fetchedAt": "ISO8601",
        "quality": [],
        "error": "optional"
      }
    ],
    "timingMs": {
      "total": 0,
      "fetch": 0,
      "compute": 0,
      "cache": "HIT | MISS"
    }
  }
}
```

- **Badge:** SAFE ≥ 80, CAUTION 50–79, HIGH_RISK < 50.
- **confidence:** 0–1; reduz quando fontes faltam ou há `data_conflict`.
- **reasons:** obrigatório; score sempre explicado.

### Erros

- **400:** mint ausente/inválido ou body inválido.
- **401:** Helius API key inválida.
- **429:** Rate limit excedido (`Retry-After` no header).
- **501:** Helius não configurado.
- **502:** Falha upstream (ex.: Helius timeout).

---

## GET `/api/status`

- **200:** `{ "success": true, "response": { "ok": true, "ts": "ISO8601", "deploymentId": null } }`.

---

## GET `/api/health`

- **200:** `{ "success": true, "response": { "ok": true, "ts", "deploymentId", "commit", "env" } }`.

---

## GET `/api/market/summary?mint=...`

- **200:** Proxy para backend ou stub local quando base não configurada.
- **400:** mint ausente.

---

## POST/GET `/api/simulate`

- Proxy para `BAGS_SHIELD_API_BASE/api/simulate`.
- **501:** Base não configurada.

---

## Token Creator (scaffold, feature flag OFF)

- Rotas sob `/api/creator/*` (ou equivalente) retornam **501 Not Implemented** quando `FEATURE_TOKEN_CREATOR=false`.
- Mensagem: "Token Creator is not enabled."

---

## Jupiter Quote (Beta)

- **GET** `/api/quote?inputMint=...&outputMint=...&amount=...&slippageBps=...`
- Rate limit aplicado.
- Resposta: quote JSON do Jupiter ou erro 4xx/5xx.
- Guardrails: minOut/slippage validados; token HIGH_RISK ou confidence baixo deve gerar warning no UI (não bloqueante).
