# Bags Shield API

### Endpoints
- `GET /api/scan?foo=bar` — ping de saúde com exemplo de score
- `POST /api/simulate` — eco seguro (JSON); 400 para JSON inválido
- `POST /api/apply` — stub com CORS/preflight
- `GET /api/token/[mint]/creators` — lista de creators (via adapter)
- `GET /api/token/[mint]/lifetime-fees` — total de taxas vitalícias (lamports)

### CORS
Habilitado via `lib/cors.ts` (preflight `OPTIONS`, headers, `Vary: Origin`).

### Rewrites (dev)
`vercel.json` mapeia rotas dinâmicas para handlers planos:
/api/token/<mint>/creators -> /api/token/creators?mint=<mint>
/api/token/<mint>/lifetime-fees -> /api/token/lifetime-fees?mint=<mint>

markdown
Copiar código

### Adapter (`lib/bags.ts`)
- Lê `BAGS_API_BASE` e `BAGS_TIMEOUT_MS`.
- Se **definido**, consulta o upstream via HTTP (timeout + fallback gracioso).
- Se **não definido**, retorna **stubs** (creators `[]`, fees `0`).

### Dev scripts
- `npm run dev`      → stub (sem upstream)
- `npm run dev:bags` → mock interno (`BAGS_API_BASE=/api/mock`)
- `npm run dev:real` → aponte para seu upstream real (edite antes)

### Smoke local
`powershell -ExecutionPolicy Bypass -File scripts\smoke.ps1`

### Variáveis na Vercel (produção/preview)
Use o CLI:
npx -y vercel@latest env add BAGS_API_BASE production
npx -y vercel@latest env add BAGS_API_BASE preview

nginx
Copiar código
Cole a URL do seu upstream quando solicitado.