# Setup Instructions

## Estrutura Criada

```
site/
├── docs/                    # Documentação
│   ├── api/
│   ├── security/
│   ├── fees-and-rewards/
│   └── legal/
├── src/
│   ├── pages/              # Landing page
│   └── css/                # Tema customizado
├── static/                 # Assets estáticos
├── docusaurus.config.js    # Configuração principal
├── sidebars.js             # Estrutura de navegação
└── package.json            # Dependências
```

## Próximos Passos

1. **Criar repositório GitHub**:

   ```bash
   cd site
   git init
   git add .
   git commit -m "Initial commit"
   # Criar repo no GitHub e fazer push
   ```

2. **Instalar dependências**:

   ```bash
   npm install
   ```

3. **Desenvolvimento local**:

   ```bash
   npm start
   ```

   Abre em `http://localhost:3000`

4. **Build para produção**:

   ```bash
   npm run build
   ```

5. **Deploy no Cloudflare Pages**:
   - Ver `DEPLOY.md` para instruções detalhadas

## Customizações Necessárias

Antes de fazer deploy, atualize:

1. **`docusaurus.config.js`**:
   - `url`: Seu domínio real
   - `organizationName`: Seu GitHub org/user
   - `projectName`: Nome do repo

2. **`src/pages/index.tsx`**:
   - URL do health check (`app.bags-shield.com`)
   - Links para app e GitHub

3. **Assets**:
   - Adicione `static/img/logo.svg`
   - Adicione `static/img/favicon.ico`
   - Adicione `static/img/bags-shield-social-card.jpg`

4. **Docs**:
   - Complete conteúdo dos arquivos `.md`
   - Adicione mais páginas conforme necessário

## Tema Visual

O tema já está configurado com:

- Fundo navy (`#020617` / `#07122a`)
- Acentos cyan (`#2FA7FF` / `#4DD4FF`)
- Efeito glass nos cards
- Botões com gradiente azul/cyan
- Status badge com animação pulse

## Integração com App

O status badge na landing page puxa `/api/health` do app. Certifique-se de que:

- O app está deployado em `app.bags-shield.com`
- O endpoint `/api/health` está funcionando
- CORS está configurado para permitir requisições do site
