# Auditoria de segredos e vazamentos

Este documento descreve o que foi verificado para **evitar vazamento de dados sensíveis** (API keys, tokens, senhas) para o GitHub ou para o cliente (browser).

---

## 1. Arquivos que NUNCA devem ser commitados

| Arquivo / padrão                                                | Motivo                   |
| --------------------------------------------------------------- | ------------------------ |
| `.env`                                                          | Contém segredos locais   |
| `.env.local`, `.env.*.local`                                    | Idem                     |
| `.env.production`, `.env.development` (com valores reais)       | Idem                     |
| Qualquer arquivo com chaves Helius, Birdeye, BAGS, Vercel, HMAC | Exposição no repositório |

**Ação:** O `.gitignore` já contém `.env`, `.env*.local` e `.cursorignore` contém `.env`, `.env.*` com exceção `!.env.example`. **Só `.env.example`** deve estar no repositório, e apenas com placeholders (ex.: `YOUR_KEY`, `change-me-in-prod`).

---

## 2. Variáveis de ambiente sensíveis (apenas no servidor)

Estas variáveis **nunca** devem ser prefixadas com `NEXT_PUBLIC_` (senão vão para o bundle do client):

- `HELIUS_API_KEY` / `HELIUS_RPC_URL`
- `BIRDEYE_API_KEY`
- `BAGS_API_KEY`
- `BAGS_SHIELD_API_BASE` (pode conter query string com key)
- `SCAN_HMAC_SECRET`
- `LAUNCHPAD_HMAC_SECRET`
- `INTEGRATION_SECRET`
- `VERCEL_TOKEN`
- `BAGS_BEARER`

Uso no código: todas são lidas via `process.env.*` em rotas API ou em módulos server-only (ex.: `src/lib/helius.ts`, `src/lib/providers/birdeye.ts`).

---

## 3. Verificações realizadas

- **Chave Helius:** Nenhuma ocorrência da chave real (ex.: `abef8daf...`) no repositório. URLs em `helius.ts` usam a variável `key` vinda de `process.env`.
- **.env.example:** Contém apenas placeholders (`HELIUS_API_KEY=`, `BAGS_BEARER=change-me-in-prod`, `SCAN_HMAC_SECRET=your-scan-hmac-secret-key-here-use-32-plus-chars`). Nenhum valor real.
- **Logs:** `SafeLogger` e `sanitizeUpstreamError` redactam padrões como `api-key=`, `token=`, `bearer`. Nenhum `console.log` de `process.env` ou de corpo de resposta com segredos.
- **Respostas HTTP:** Nenhum header ou body que exponha chaves. Erros em produção são genéricos (sem stack ou mensagem interna).
- **Client (browser):** O internal-api da launchpad foi alterado para usar **apenas** `BAGS_SHIELD_API_BASE` (server-side), removendo `NEXT_PUBLIC_API_BASE` para evitar que uma URL com key seja exposta no client.
- **Launchpad manifest:** Em produção, não é mais usado secret default; se `LAUNCHPAD_HMAC_SECRET` não estiver definido, a rota retorna 503.

---

## 4. .gitignore e .cursorignore

- **.gitignore:** `.env`, `.env*.local` estão listados; `.env.example` não está ignorado (correto).
- **.cursorignore:** `.env`, `.env.*` com `!.env.example`, para que o Cursor não leia arquivos de ambiente reais.

Se você criar novos arquivos de ambiente (ex.: `.env.production.local`), não os commite. Use sempre variáveis no painel da Vercel (ou equivalente) para produção.

---

## 5. Checklist antes de cada push

- [ ] Nenhum arquivo `.env` ou `.env.local` (ou cópia) está no stage.
- [ ] Nenhum valor real de API key/token em comentários, docs ou exemplos (use `SUA_CHAVE`, `YOUR_KEY`, etc.).
- [ ] Nenhuma URL contendo `api-key=` ou `token=` em código ou docs, exceto em exemplos genéricos.

Para conferir:  
`git diff --cached` e `git status` antes do commit; em caso de dúvida, `git reset HEAD <arquivo>` e adicione o caminho ao `.gitignore` se necessário.

---

_Última auditoria: 2025-02-08. Atualize este documento se novas variáveis sensíveis forem introduzidas._
