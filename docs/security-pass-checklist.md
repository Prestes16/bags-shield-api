# Security Pass — Checklist Beta

Conferência pós-implementação (threat model curto, rotas, segredos, limites).

---

## Threat model (STRIDE resumido)

| Ameaça          | Mitigação atual                                                           |
| --------------- | ------------------------------------------------------------------------- |
| Spoofing        | Rate limit por IP; sem auth no scan (público).                            |
| Tampering       | Zod strict no request; mint/wallet base58; HMAC opcional na resposta.     |
| Repudiation     | X-Request-Id + logs estruturados; sem PII/segredos em log.                |
| Info disclosure | no-store; erros genéricos em prod; sanitizeUpstreamError em logs.         |
| DoS             | Rate limit (scan 20/min, quote 30/min); timeouts; circuit breaker; cache. |
| Elevation       | Token Creator desligado por flag; sem rotas admin expostas.               |

---

## Rotas expostas

- `/api/scan` — GET/POST, rate limit, validação forte, Helius obrigatório.
- `/api/quote` — GET, rate limit, Zod strict.
- `/api/status`, `/api/health` — leitura, sem segredos.
- `/api/market/summary` — proxy ou stub; validar mint no proxy.
- `/api/simulate` — proxy; 501 se base não configurada.
- `/api/creator` — 501 (scaffold).
- Launchpad: conforme feature flags e env.

---

## Checagens

- [ ] **App não contém segredos:** Nenhuma `NEXT_PUBLIC_*` com chaves de API; Helius/Birdeye só no servidor.
- [ ] **CORS/origins:** Em produção, `CORS_ORIGINS` restritivo (lista de origens).
- [ ] **Rate limits:** Scan e quote com limite por IP; 429 com Retry-After.
- [ ] **Payload limits:** Scan body 16KB; query params validados (tamanho implícito).
- [ ] **Logs sem PII/segredos:** SafeLogger; sanitizeUpstreamError; nenhum log de body completo com tokens.
- [ ] **Scan não enganável por parâmetros:** Mint 32–44 base58; rejeição de chaves desconhecidas (strict); sem aceitar mint inválida ou unicode malicioso.

---

## Observabilidade

- `X-Request-Id` em respostas e propagado quando há proxy.
- `meta.requestId` e `meta.sources` no scan com latência e quality.
- `meta.timingMs` (total, fetch, compute, cache).

---

_Preencher/conferir antes do release Beta._
