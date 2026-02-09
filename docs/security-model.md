# Bags Shield — Modelo de Segurança (Beta)

## Princípios

1. **Fail-closed:** Se dado crítico faltar ou for inconsistente, degradar score com `confidence` e explicação em `reasons` — nunca inventar dados.
2. **Dados externos não confiáveis:** Helius, DexScreener, Birdeye, Meteora são tratados como entradas não confiáveis: validação de shape, sanity checks, limites e, quando possível, cross-check entre fontes.
3. **Anti-forja:** Incluir `meta.sources[]` com timestamps, latência e quality flags; normalizar e deduplicar; detectar divergência (ex.: preço/volume) e marcar `signals.data_conflict=true`.
4. **Anti-DoS:** Rate limit por IP (e por chave quando aplicável), timeouts curtos, circuit breaker, backoff em 429/5xx, cache agressivo em endpoints caros.
5. **Sem segredos em logs ou no client:** Env vars apenas no servidor; redação de erros em respostas de produção.
6. **Contratos estáveis:** Todo endpoint com schema (Zod) e `additionalProperties: false` onde aplicável.
7. **Observabilidade:** `X-Request-Id`, `meta.requestId`, tempo por provider, logs estruturados.

## Mitigações por ameaça (STRIDE resumido)

| Ameaça                     | Mitigação                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------ |
| **Spoofing**               | Não armazenamos identidade de usuário no scan; rate limit por IP.                    |
| **Tampering**              | Validação de input (Zod, mint/wallet base58); integridade HMAC opcional na resposta. |
| **Repudiation**            | Logs estruturados + requestId; sem PII/segredos.                                     |
| **Information disclosure** | No-store em respostas sensíveis; erros genéricos em produção.                        |
| **DoS**                    | Rate limit, timeouts, circuit breaker, cache.                                        |
| **Elevation of privilege** | Token Creator desligado por feature flag; rotas admin futuras com auth.              |

## Variáveis de ambiente sensíveis

- `HELIUS_API_KEY` / `HELIUS_RPC_URL` — nunca em client; usadas apenas em rotas server-side.
- `BIRDEYE_API_KEY` — idem.
- `SCAN_HMAC_SECRET` — apenas para assinatura de resposta (opcional).
- Nenhuma chave deve ser exposta em logs ou headers.

## CORS

- Em produção, `CORS_ORIGINS` deve listar apenas origens permitidas (app e dev).
- Default em dev pode ser `*` para facilitar testes.

## Rate limits

- **Scan:** 20 req/min por IP (janela 1 min).
- **Quote (Jupiter):** a definir (ex.: 30 req/min por IP).
- Resposta 429 com header `Retry-After`.

## Resposta parcial (degradação)

- Em falha de um ou mais providers, o scan retorna 200 com score e `confidence` reduzidos e `meta.sources[]` indicando qual fonte falhou.
- 501 apenas quando Helius não está configurado; 502 quando Helius falha de forma bloqueante.
