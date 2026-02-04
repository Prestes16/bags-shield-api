# Deploy Guide - Cloudflare Pages

## Pré-requisitos

1. Conta no Cloudflare
2. Repositório GitHub criado (`bags-shield-site`)
3. Domínio configurado no Cloudflare

## Passo 1: Criar Repositório

```bash
cd site
git init
git add .
git commit -m "Initial commit: Bags Shield site"
git remote add origin https://github.com/bags-shield/bags-shield-site.git
git push -u origin main
```

## Passo 2: Conectar ao Cloudflare Pages

1. Acesse [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Vá em **Workers & Pages** → **Pages**
3. Clique em **Create project**
4. Conecte seu repositório GitHub
5. Configure:
   - **Framework preset**: Docusaurus
   - **Build command**: `npm run build`
   - **Build output directory**: `build`
   - **Root directory**: `/` (ou `/site` se repo na raiz)
   - **Node version**: 18

## Passo 3: Configurar Domínio

1. No projeto Pages, vá em **Custom domains**
2. Clique em **Set up a custom domain**
3. Adicione:
   - `bags-shield.com` (ou seu domínio)
   - `docs.bags-shield.com` (opcional, subdomínio)

**IMPORTANTE**: Não crie CNAME manualmente antes de associar no Pages, senão dá erro 522.

## Passo 4: Variáveis de Ambiente (se necessário)

Se precisar de env vars:

1. No projeto Pages → **Settings** → **Environment variables**
2. Adicione variáveis necessárias (ex: `API_BASE_URL`)

## Passo 5: Deploy Automático

Após conectar, cada push para `main` faz deploy automático.

## Verificação

1. Acesse `https://bags-shield.com`
2. Verifique que o status badge mostra "Online"
3. Teste navegação e docs

## Troubleshooting

- **Erro 522**: Domínio não associado corretamente no Pages
- **Build falha**: Verifique Node version (deve ser 18+)
- **404 em rotas**: Verifique `baseUrl` no `docusaurus.config.js`
