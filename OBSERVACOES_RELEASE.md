# Observações (Release Candidate)

- **Imports ESM ajustados para Node 20 no Vercel** (sem `ERR_MODULE_NOT_FOUND`).
- **`/api/scan` estável**: retorna 200 (válido) ou 400 (inválido). Não deve dar 404/500 em uso normal.
- **`app.html` redireciona para `/app-v4.html`** e está em UTF-8 (sem mojibake).
- **UI v4 completa**: views + ações conectadas (mesmo com stubs quando faltam chaves).
- **Graceful handling**: rotas dependentes de API keys retornam 501 com mensagem clara (sem stacktrace).
- **Segurança básica**: validação de payload, no-store, sem vazamento de erro interno.
