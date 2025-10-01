# Bags Shield — Fase 4 · API (Vercel)

API serverless do **Bags Shield** para varredura de risco e ações sobre tokens/projetos, conforme “DOCUMENTOS BAGS”. Implementação em **Vercel Functions** (Node 20, TypeScript), com rotas REST, CORS e respostas padronizadas.

---

## Sumário
- [Stack](#stack)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Execução local](#execução-local)
- [Scripts de teste (opcional)](#scripts-de-teste-opcional)
- [Variáveis na Vercel](#variáveis-na-vercel)
- [Padrões de resposta](#padrões-de-resposta)
- [Rotas](#rotas)
  - [/api/health](#apihealth-get)
  - [/api/scan](#apiskan-post)
  - [/api/simulate](#apisimulate-post)
  - [/api/apply](#apiapply-post)
- [Erros](#erros)
- [Boas práticas](#boas-práticas)
- [Licença](#licença)

---

## Stack
- **Runtime:** Node.js 20 (Vercel)
- **Linguagem:** TypeScript
- **Infra:** Serverless Functions (região padrão `gru1`)
- **Empacotamento:** automático via Vercel
- **Testes rápidos:** cURL / Postman / scripts Node

> `vercel.json` define memória, duração, CORS básico e rewrite `/health` → `/api/health`.

---

## Estrutura de pastas
