# Roadmap — Integrações Bags

## Objetivo
Adicionar rotas sob `/api/bags/*` com cliente resiliente, resposta padrão `{ ok, data|error, meta: { requestId, time } }`, CORS liberando `X-Request-Id` e `Cache-Control: no-store`.

## Ordem 1×1 proposta
1) **lib/bags.ts** — cliente HTTP:
- Base URL via `BAGS_API_BASE` (opcional).
- Timeout `BAGS_TIMEOUT_MS` (default 5000).
- Retentativas com backoff exponencial + jitter para 429/5xx (máx 3).
- Propagar `requestId` retornado pelo upstream quando houver.

2) **Endpoints** (cada um em rodada própria):
- `GET /api/bags/token-info?mint=<pubkey>`
- `GET /api/bags/launch-config?mint=<pubkey>`
- `GET /api/bags/pool-config?mint=<pubkey>`

3) **Smokes** por rota:
- HEAD/GET respondendo 200; headers: `X-Request-Id` e `Access-Control-Expose-Headers: X-Request-Id`.
- Body contendo `meta.requestId`.

## Env vars envolvidas
- `BAGS_API_BASE` (opcional para DEV/mocks).
- `BAGS_TIMEOUT_MS=5000` (default).
- `BAGS_API_KEY` (quando habilitarmos chamadas autenticadas).
- `SOLANA_RPC_URL` (quando necessário em scripts utilitários).

## Segurança
- Nunca comitar chaves reais (`.env*` já ignorado).
- Sanitização de query params; limites de tamanho e timeouts.

## Deploy/Operação
- Ritual: deploy → smokes → alias → tag → morning smokes.
- Logs em `logs/smoke-*.txt` via `scripts/morning-smokes.ps1`.

