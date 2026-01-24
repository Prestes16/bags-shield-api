# Launchpad Integration Guide

## Visão Geral

A Launchpad está totalmente integrada no app Bags Shield e pronta para uso com chamadas de API reais.

## Navegação

A Launchpad está acessível através de:

1. **Dashboard Principal** (`/`)
   - Botão "Launchpad" no header
   - Navega para `/launchpad`

2. **Página da Launchpad** (`/launchpad`)
   - Landing page com cards de ação
   - Links para Create, History, Docs
   - Status do feature flag

3. **Layout Consistente**
   - Barra de navegação em todas as páginas
   - Links rápidos para Home, Create, History
   - Botão de volta para Dashboard

## Fluxo Completo

### 1. Criar Token (`/launchpad/create`)

- Formulário completo para TokenDraft e LaunchConfigDraft
- Auto-save no localStorage
- Validação client-side
- Navega para `/launchpad/review` ao submeter

### 2. Review & Launch (`/launchpad/review`)

**Passo 1: Preflight**
- Chama `/api/launchpad/preflight`
- Valida configuração completa
- Mostra issues e warnings

**Passo 2: Criar Token**
- Chama `/api/launchpad/token-info` (cria token real)
- Obtém mint address

**Passo 3: Criar Config**
- Chama `/api/launchpad/create-config` (cria config real)
- Obtém configKey e tx

**Passo 4: Scan & Manifest**
- Chama `/api/scan` para obter shield score real
- Gera manifest com hash e assinatura HMAC
- Salva no histórico

**Passo 5: Launch**
- Salva no histórico (localStorage)
- Navega para página do token

### 3. Token Page (`/launchpad/[mint]`)

- Carrega do histórico ou faz scan do token
- Mostra Shield Proof completo
- Badges, score, grade
- Links para histórico e criar novo

### 4. History (`/launchpad/history`)

- Lista todos os tokens lançados
- Cards com informações resumidas
- Clique para ver detalhes
- Botão para criar novo token

## API Client

Cliente centralizado em `src/lib/launchpad/api-client.ts`:

- `createTokenInfo()` - Cria token metadata
- `createLaunchConfig()` - Cria launch config
- `runPreflight()` - Valida configuração
- `generateManifest()` - Gera manifest com hash/signature

Todas as funções retornam `ApiResponse<T>` padronizado.

## Chamadas de API Reais

### Modo Real (LAUNCHPAD_MODE=real)

1. **POST /api/launchpad/token-info**
   - Chama Bags API `create-token-info`
   - Retorna tokenMint real
   - Requer `BAGS_API_KEY`

2. **POST /api/launchpad/create-config**
   - Chama Bags API `create-config`
   - Retorna configKey e tx
   - Requer `BAGS_API_KEY`

3. **POST /api/launchpad/preflight**
   - Valida localmente (não chama Bags)
   - Retorna issues e warnings

4. **POST /api/launchpad/manifest**
   - Gera hash SHA-256
   - Assina com HMAC-SHA256
   - Retorna manifest completo

5. **GET /api/scan?mint=...**
   - Obtém shield score real do token
   - Usado para popular manifest

## Estado e Persistência

### localStorage

- **`launchpad.draft`**: Draft atual sendo criado
- **`launchpad.history`**: Histórico de tokens lançados (últimos 50)

### Auto-save

- Draft é salvo automaticamente a cada mudança (debounced 500ms)
- Não perde dados ao recarregar página
- Pode continuar de onde parou

## Tratamento de Erros

### Erros de API

- Exibidos de forma amigável (sem stack traces)
- Mostra `error.message` e `issues[]`
- Permite corrigir e tentar novamente

### Validação

- Client-side antes de enviar
- Server-side com schemas Zod
- Retorna `issues[]` estruturado

## Configuração

Veja [SETUP.md](./SETUP.md) para configuração completa.

### Mínimo para Funcionar

```bash
LAUNCHPAD_ENABLED=true
LAUNCHPAD_MODE=real
BAGS_API_KEY=sua-chave
```

## Testes

### Testar Localmente

1. Configure `.env` com `LAUNCHPAD_ENABLED=true`
2. Inicie o servidor: `npm run dev`
3. Acesse `http://localhost:3000/launchpad`
4. Crie um token de teste

### Smoke Tests

```powershell
# Testar endpoints
.\scripts\smoke-launchpad.ps1 -BaseUrl "http://localhost:3000"
```

## Próximos Passos

1. ✅ UI completa e funcional
2. ✅ Integração com APIs reais
3. ✅ Navegação integrada no app
4. ✅ Estado persistente (localStorage)
5. ✅ Tratamento de erros
6. ✅ Documentação completa

A Launchpad está **pronta para uso**! 🚀
