# Bags Shield Beta — Relatório de Gaps (Inventário)

**Data:** 2025-02-08  
**Objetivo:** Inventário real do que existe antes da implementação Beta (scanner anti-rug, multi-fonte, score real, swap Jupiter, hardening).

---

## 1. Endpoints existentes e estado

| Endpoint                    | Método    | Estado       | Observação                                                                                                                                                                                                                                            |
| --------------------------- | --------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/scan`                 | GET, POST | **Parcial**  | Funcional com Helius + DexScreener + Birdeye + Meteora; score **fixo 80**, grade **B**; formato de resposta **não canônico** (falta `reasons[]`, `confidence`, `meta.sources[]` com latency/quality, `signals.data_conflict`, `pools[]` normalizado). |
| `/api/status`               | GET       | **OK**       | Retorna `ok`, `ts`, `deploymentId`.                                                                                                                                                                                                                   |
| `/api/health`               | GET, HEAD | **OK**       | Retorna `ok`, `ts`, `deploymentId`, `commit`, `env`.                                                                                                                                                                                                  |
| `/api/market/summary`       | GET       | **Parcial**  | Proxy para `BAGS_SHIELD_API_BASE`; se base não configurada retorna stub local. Sem validação forte de `mint`.                                                                                                                                         |
| `/api/simulate`             | GET, POST | **Parcial**  | Proxy via `forwardToBackend` para `/api/simulate`; se `BAGS_SHIELD_API_BASE` não definido → 501.                                                                                                                                                      |
| `/api/rpc/health`           | GET       | **OK**       | Checa RPC (SOLANA_RPC_URL / Helius).                                                                                                                                                                                                                  |
| `/api/_whoami`              | GET       | **OK**       | Debug/identificação.                                                                                                                                                                                                                                  |
| `/api/launchpad/*`          | Vários    | **Parcial**  | create-config, manifest, preflight, status, submit, token-info — dependem de Launchpad; podem ser stub.                                                                                                                                               |
| `/api/launchpad/token-info` | GET       | **Parcial**  | Token info para launchpad.                                                                                                                                                                                                                            |
| Jupiter / quote / swap      | —         | **Quebrado** | **Não existe** rota de quote ou swap; apenas menção no site (landing).                                                                                                                                                                                |

**Resumo:** Scan é o único “motor” ativo; retorno não segue contrato Beta (score real, reasons, confidence, meta.sources). Swap Jupiter não implementado.

---

## 2. Onde já estão integrados (Helius, Jupiter, Meteora, DexScreener, Birdeye)

| Fonte             | Arquivo(s)                  | Função / Uso                                                                                                   | Env                                  |
| ----------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Helius**        | `src/lib/helius.ts`         | `getHeliusRpcUrl()`, `getApiKey()`, `getHeliusParseTransactionsUrl()`, `getHeliusParseTransactionHistoryUrl()` | `HELIUS_RPC_URL` ou `HELIUS_API_KEY` |
| **Helius (scan)** | `src/lib/scan/upstreams.ts` | `fetchHelius(mint)` — DAS `getAsset` via JSON-RPC                                                              | Mesmo acima                          |
| **DexScreener**   | `src/lib/scan/upstreams.ts` | `fetchDexScreener(mint)` — `GET .../token-pairs/v1/solana/{mint}`                                              | Nenhum (público)                     |
| **Birdeye**       | `src/lib/scan/upstreams.ts` | `fetchBirdeye(mint)` — `token_overview`                                                                        | `BIRDEYE_API_KEY`                    |
| **Meteora**       | `src/lib/scan/upstreams.ts` | `fetchMeteora(mint)` — `GET dlmm-api.meteora.ag/pair/all` + filtro por mint                                    | Nenhum                               |
| **Jupiter**       | —                           | **Não integrado**                                                                                              | —                                    |

**Conclusão:** Helius, DexScreener, Birdeye e Meteora estão em `upstreams.ts`; não há `fetchGuard`, circuit breaker, cache centralizado nem normalização de dados. Jupiter não existe.

---

## 3. Motor de score e sinais existentes

- **Onde:** `src/app/api/scan/route.ts` → `runLocalScan()`.
- **Score atual:** **fixo** `score: 80`, `grade: 'B'` (hardcoded).
- **Sinais:** Nenhum motor de regras; apenas badges por upstream OK (helius, dexscreener, birdeye, meteora).
- **Penalidades/regras:** Não implementadas (LP lock, concentração top-10, sell tax, mint ativa, etc.).
- **Badges:** Lista estática baseada em status de cada upstream.

**Conclusão:** Não existe motor de score real; é necessário criar `lib/score/` (signals, rules, engine, explain) e integrar ao scan.

---

## 4. Mocks / stubs e vazamento para produção

- **Scan:** Quando `BAGS_SHIELD_API_BASE` está definido, o app faz **proxy** para o backend; quando não está, executa **runLocalScan** (dados reais de upstreams, mas score fixo). Não há “mock” explícito que retorne dados falsos; o score fixo é o único comportamento “mockado”.
- **Market summary:** Se `BAGS_SHIELD_API_BASE` não está definido, retorna `{ note: 'stub market summary (local)' }` — **stub em produção** se variável não for definida.
- **Simulate:** Retorna 501 se `BAGS_SHIELD_API_BASE` não definido; não vaza mock.
- **Launchpad:** Modo stub/real controlado por env; stubs retornam respostas controladas, não dados inventados sensíveis.

**Risco:** Market summary stub pode ser exposto em produção se ninguém configurar a base. Recomendação: em produção, exigir base ou retornar 503 em vez de stub.

---

## 5. Check de segurança

| Item                     | Estado    | Observação                                                                                                                                       |
| ------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **CORS**                 | Parcial   | `lib/env.ts` → `CORS_ORIGINS`; `src/lib/security/cors.ts` usa `getCorsOrigins()` (raiz `lib/env`). Default `*`; em produção deve ser restritivo. |
| **Rate limit**           | OK (scan) | Scan: 20 req/min por IP em `route.ts` (in-memory). `src/lib/security/rateLimit.ts` existe para uso genérico.                                     |
| **Auth**                 | Parcial   | Algumas rotas usam Bearer; scan não exige auth (apenas rate limit por IP).                                                                       |
| **Headers**              | OK        | `no-store`, `X-Request-Id`, security headers aplicados no scan.                                                                                  |
| **Timeouts**             | OK        | `upstreams.ts`: 4s por fetch; proxy 12s.                                                                                                         |
| **Input validation**     | OK        | Scan: Zod, mint 32–44, LaunchpadValidator; body size 16KB.                                                                                       |
| **Output sanitation**    | OK        | `sanitizeUpstreamError` para logs; sem segredos em resposta.                                                                                     |
| **Payload limits**       | OK        | 16KB no scan.                                                                                                                                    |
| **additionalProperties** | OK        | ScanRequestSchema `.strict()`.                                                                                                                   |

**Conclusão:** Base sólida; falta CORS restritivo em prod, rate limit em outras rotas caras (ex.: quote) e documentação explícita (security-model, api-contracts).

---

## 6. Gaps prioritários para Beta

1. **Contrato canônico do scan** — Resposta com `response.score`, `response.badge` (SAFE|CAUTION|HIGH_RISK), `response.confidence`, `response.reasons[]`, `response.signals`, `response.market`, `response.pools[]`, `response.actors`, `meta.sources[]` (name, ok, latencyMs, fetchedAt, quality), `meta.timingMs`, `meta.requestId`.
2. **Score engine real** — `lib/score/` com signals, rules, engine, explain; testes unitários.
3. **Coleta multi-fonte com normalização** — `lib/providers/` com fetchGuard (timeout, retry, circuit breaker, validação de schema), cache por provider+method+params, TTL diferenciado.
4. **Cross-check e data_conflict** — Comparar preço/volume entre Birdeye e DexScreener; reduzir confidence e adicionar reason em divergência.
5. **Jupiter** — Rota(s) quote (e opcionalmente swap wiring no app) com rate limit, minOut/slippage, warning para HIGH_RISK/baixa confidence.
6. **Token creator** — Apenas scaffold com feature flag `FEATURE_TOKEN_CREATOR=false`, rotas 501.
7. **Documentação** — `docs/security-model.md`, `docs/api-contracts.md`; atualizar este relatório após implementação.
8. **Helius** — Garantir `.env.example` e documentação com placeholders; chave real apenas em env (nunca no repo).

---

## 7. Env vars necessárias para Beta

- `HELIUS_RPC_URL` ou `HELIUS_API_KEY` — obrigatório para scan.
- `BIRDEYE_API_KEY` — opcional; sem ela Birdeye fica down (degraded).
- `BAGS_SHIELD_API_BASE` — opcional; quando definido, scan/simulate podem fazer proxy.
- `SCAN_HMAC_SECRET` — opcional; para integridade da resposta (hash + assinatura).
- `CORS_ORIGINS` — em produção, lista restrita de origens.
- `FEATURE_TOKEN_CREATOR` — false para Beta (scaffold desligado).

---

---

## 8. Status pós-implementação (2025-02-08)

- **Scan:** Pipeline real implementado: `lib/providers` (Helius, Birdeye, DexScreener, Meteora) com fetchGuard, cache e circuit breaker; `lib/score` (signals, rules, engine, explain, collectSignals); `/api/scan` retorna contrato canônico com score, badge, confidence, reasons, meta.sources e timingMs.
- **Quote:** `GET /api/quote` (Jupiter) com rate limit e validação Zod.
- **Token Creator:** Scaffold em `src/lib/creator` e `/api/creator`; 501 quando `FEATURE_TOKEN_CREATOR=false`.
- **Docs:** `docs/security-model.md`, `docs/api-contracts.md`, `docs/security-pass-checklist.md`, `docs/BETA-MANUAL-FIXES.md`.
- **Ajustes manuais:** Ver `docs/BETA-MANUAL-FIXES.md` (Helius/Birdeye env, CORS, testes Jest, typecheck, UI do app).

_Relatório gerado como requisito do Definition of Done Beta. Atualizar após cada PR relevante._
