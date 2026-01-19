# Setup UI Completo - Next.js + shadcn/ui

## ✅ Estrutura Criada

```
bags-shield-api/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout com metadata
│   ├── page.tsx           # Home page
│   └── globals.css         # Tailwind CSS + shadcn variables
├── components/            # Componentes React
│   └── ui/                # Componentes shadcn/ui
│       └── button.tsx     # Componente Button básico
├── lib/
│   └── utils.ts           # cn() helper para Tailwind
├── components.json         # Configuração shadcn/ui
├── tailwind.config.ts     # Configuração Tailwind
├── postcss.config.js       # PostCSS para Tailwind
└── next.config.js          # Configuração Next.js
```

## ✅ Dependências Instaladas

- Next.js 14.2.0
- React 18.3.0
- Tailwind CSS 3.4.19
- shadcn/ui (via components.json)
- @radix-ui/react-slot
- class-variance-authority

## 🚀 Como Usar

### 1. Iniciar Desenvolvimento
```bash
npm run dev
```
Acesse: http://localhost:3000

### 2. Adicionar Componentes shadcn/ui

#### Componentes padrão:
```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add input
```

#### Componentes do v0.app:
```bash
npx shadcn@latest add "URL_DO_V0" --yes
```

**Importante:** Se perguntar sobre sobrescrever `package.json`, responda **N** (não).

### 3. Usar Componentes

```tsx
// app/page.tsx ou qualquer página
import { Button } from "@/components/ui/button"

export default function Page() {
  return (
    <div>
      <Button>Clique aqui</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="destructive">Delete</Button>
    </div>
  )
}
```

## 📝 Próximos Passos

1. **Adicionar mais componentes shadcn/ui:**
   ```bash
   npx shadcn@latest add card
   npx shadcn@latest add dialog
   npx shadcn@latest add form
   ```

2. **Criar páginas:**
   - Criar arquivos em `app/` (ex: `app/dashboard/page.tsx`)
   - Usar App Router do Next.js

3. **Integrar com API:**
   - Usar `fetch` para chamar `/api/*`
   - Criar hooks customizados se necessário

4. **Deploy:**
   - O Vercel detecta automaticamente Next.js
   - API continua funcionando em `/api/*`
   - UI será servida em `/`

## ⚠️ Notas Importantes

- **Conflito com app/ Android:** Existe um diretório `app/` do projeto Android. O Next.js vai usar `app/` para App Router. Se houver conflito, considere mover o projeto Android para `android-app/`.

- **API Serverless:** As rotas `/api/*` continuam funcionando normalmente como serverless functions do Vercel.

- **Build:** `npm run build` compila tanto Next.js quanto as serverless functions.

## 🔧 Troubleshooting

### Erro: "Cannot find module '@/components/ui/button'"
- Verifique se `tsconfig.json` tem `"@/*": ["./*"]` em paths
- Verifique se o componente existe em `components/ui/`

### Erro: "Tailwind classes not working"
- Verifique se `tailwind.config.ts` está correto
- Verifique se `app/globals.css` importa Tailwind
- Reinicie o dev server

### Erro: "Module not found: @radix-ui/react-slot"
- Execute: `npm install @radix-ui/react-slot class-variance-authority`
