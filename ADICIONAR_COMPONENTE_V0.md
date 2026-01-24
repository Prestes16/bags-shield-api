# Como Adicionar Componentes do v0.app

## Comando Atual

```bash
npx shadcn@latest add "https://v0.app/chat/b/b_EpOXv8MS2az?token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..PoGzrvWLQk3ITVG3.UUTEtti47pHTlYQkSiYpVN6bwSn74ojVOk262q4gDtruvK4wq3F9DSvjiTo.ApcyhbIRWETc7s80vzWxSA" --yes
```

## Respostas aos Prompts

Quando o comando perguntar sobre sobrescrever arquivos:

1. **package.json** → Digite `N` e pressione Enter
   - **Motivo:** Manter as configurações existentes do projeto

2. **layout.tsx** → Digite `N` e pressione Enter  
   - **Motivo:** Manter o layout root existente

3. **Novos componentes em components/ui/** → Digite `Y` ou pressione Enter
   - **Motivo:** Aceitar os novos componentes do v0.app

## Estrutura Atual

```
components/ui/
├── button.tsx          # Componente Button (já existe)
└── [novos componentes serão adicionados aqui]
```

## Após Adicionar

1. Verifique os componentes criados:
   ```bash
   ls components/ui/
   ```

2. Use os componentes nas páginas:
   ```tsx
   import { ComponentName } from "@/components/ui/component-name"
   ```

3. Teste localmente:
   ```bash
   npm run dev
   ```

## Troubleshooting

### Erro: "Cannot find module"
- Verifique se o componente foi criado em `components/ui/`
- Verifique se `tsconfig.json` tem os paths corretos

### Componente não aparece
- Verifique se todas as dependências foram instaladas
- Execute `npm install` novamente se necessário
