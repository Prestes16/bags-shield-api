# Estrutura UI - Next.js + shadcn/ui

Este projeto agora suporta tanto a API serverless quanto uma UI moderna com Next.js e shadcn/ui.

## Estrutura

```
bags-shield-api/
├── api/              # Serverless functions (Vercel)
├── app/              # Next.js App Router
│   ├── layout.tsx   # Root layout
│   ├── page.tsx     # Home page
│   └── globals.css  # Tailwind CSS
├── components/       # Componentes React (shadcn/ui)
├── lib/              # Utilitários compartilhados
│   └── utils.ts     # cn() helper para Tailwind
└── public/           # Arquivos estáticos
```

## Comandos

### Desenvolvimento
```bash
npm run dev          # Inicia Next.js dev server (porta 3000)
```

### Build
```bash
npm run build        # Build Next.js para produção
npm run start        # Inicia servidor Next.js em produção
```

### API (continua funcionando)
- `/api/*` - Serverless functions do Vercel
- Funciona tanto localmente quanto em produção

## Adicionar Componentes shadcn/ui

### Componentes padrão
```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
```

### Componentes do v0.app
```bash
npx shadcn@latest add "URL_DO_V0" --yes
```

**Nota:** Se perguntar sobre sobrescrever `package.json`, responda **N** (não) para manter as configurações existentes.

## Configuração

- **Tailwind CSS**: Configurado em `tailwind.config.ts`
- **shadcn/ui**: Configurado em `components.json`
- **TypeScript**: Configurado em `tsconfig.json` (inclui `app/` e `components/`)
- **Next.js**: Configurado em `next.config.js`

## Deploy no Vercel

O Vercel detecta automaticamente:
- Next.js para rotas `/` (UI)
- Serverless functions para rotas `/api/*` (API)

Não é necessária configuração adicional!

## Próximos Passos

1. Adicionar componentes shadcn/ui conforme necessário
2. Criar páginas em `app/` usando App Router
3. Usar componentes em `components/ui/` nas páginas
4. A API continua funcionando normalmente em `/api/*`
