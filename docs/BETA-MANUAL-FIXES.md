# Relatório privado — Ajustes manuais pós-Beta

Use este documento para conferir e, se necessário, corrigir manualmente itens que dependem do ambiente ou de decisões de produto.

---

## 1. Chave Helius (produção/local)

- **Onde:** Variáveis de ambiente (`.env`, `.env.local` ou painel Vercel).
- **O que fazer:** Defina **uma** das duas:
  - `HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=SUA_CHAVE`
  - ou `HELIUS_API_KEY=SUA_CHAVE`
- **Importante:** Não commitar a chave real no repositório. O `.env.example` contém apenas placeholders.

---

## 2. Birdeye (opcional)

- Sem `BIRDEYE_API_KEY`, o scan continua funcionando, mas a fonte Birdeye fica "down" e a **confidence** pode ser menor.
- Para máxima qualidade do score, configure `BIRDEYE_API_KEY` no ambiente.

---

## 3. CORS em produção

- **Onde:** `CORS_ORIGINS` (ou equivalente em `lib/env.ts`).
- **O que fazer:** Em produção, defina uma lista restrita de origens (ex.: `https://seu-app.vercel.app,https://www.seudominio.com`). Evite `*` em prod.

---

## 4. Testes (Jest)

- Os testes em `src/lib/score/__tests__/` e `src/app/api/scan/__tests__/` usam Jest.
- Se o `typecheck` falhar com "Cannot find name 'describe'/'it'/'expect'":
  - Instale: `npm i -D jest @types/jest ts-jest`
  - Ou exclua as pastas `**/__tests__/**` do `tsconfig.json` usado no build (mantendo um `tsconfig.test.json` para rodar testes).
- Rodar testes: `npx jest src/lib/score --passWithNoTests`.

---

## 5. Typecheck e monorepo

- O projeto contém `app/`, `site/` (Docusaurus) e `src/`. O `tsc` pode acusar erros em:
  - `app/` ou `site/` (versões diferentes de Next/Docusaurus)
  - `node_modules` (ex.: `@solana/web3.js`)
- **Sugestão:** Rodar typecheck apenas no código da API: por exemplo, um `tsconfig.json` que inclua só `src/` (e eventualmente `lib/` na raiz), ou corrigir versões de dependências em `app/` e `site/` conforme necessário.

---

## 6. Resposta do scan e integridade (HMAC)

- Se `SCAN_HMAC_SECRET` não estiver definido, a resposta do scan não inclui `integrity` (hash + assinatura). O scan continua funcionando; apenas a verificação de integridade fica desativada.
- Para ativar: gere um segredo forte (32+ caracteres) e defina `SCAN_HMAC_SECRET` no servidor.

---

## 7. Token Creator

- Rotas em `/api/creator` retornam **501** enquanto `FEATURE_TOKEN_CREATOR` não for `true`.
- Para ativar no futuro: `FEATURE_TOKEN_CREATOR=true` e implementar a lógica em `src/lib/creator/` e nas rotas correspondentes.

---

## 8. Market summary stub

- Se `BAGS_SHIELD_API_BASE` não estiver definido, `GET /api/market/summary?mint=...` retorna um stub local (`note: 'stub market summary (local)'`).
- Em produção, configure a base ou altere o comportamento para retornar **503** em vez de stub (conforme sugerido no `beta-gap-report.md`).

---

## 9. UI do app (swap / resultado do scan)

- A rota **GET /api/quote** está implementada e pronta para o Jupiter.
- O front-end (páginas de swap e tela de resultado do scan) deve:
  - Chamar `GET /api/scan?mint=...` e exibir `response.score`, `response.badge`, `response.reasons`, `response.confidence`.
  - Para swap: chamar `GET /api/quote?inputMint=...&outputMint=...&amount=...&slippageBps=...` e, se o token for HIGH_RISK ou confidence baixo, mostrar aviso (com fricção) antes de prosseguir.
- Ajustes de layout e textos ficam a cargo do time de produto/front.

---

_Documento gerado como parte do Security Pass e Definition of Done Beta. Atualize conforme o projeto evoluir._
