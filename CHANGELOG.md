# Changelog

## 1.2.1 — 2025-10-10
- **API**: validação com Zod embutida diretamente nos wrappers de `/api/simulate` e `/api/apply` (ESM-safe; sem imports relativos).
- **Compatibilidade**: atualização do TypeScript para `5.6.x` para suportar declarações modernas (Zod). Alternativamente, Zod fixado em `3.23.8` para reduzir ruído em dev.
- **Roteamento**: rotas `api/simulate.ts` e `api/apply.ts` agora delegam explicitamente para `./simulate/index.js` e `./apply/index.js`.
- **Robustez**: tratamento tolerante de `Authorization: Bearer ...` e `Content-Type` com mensagens 400 padronizadas (`code: "BAD_REQUEST"`, `issues`).
- **Dev**: script `dev:vercel` com `NODE_OPTIONS=--no-deprecation` para silenciar avisos de APIs internas depreciadas no ambiente de dev da Vercel.

## 1.1.0 — 2025-10-01
- Primeira versão pública do Bags Shield API.
