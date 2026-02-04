# Configuração Rápida - Jupiter API (Swap)

## ⚠️ Avisos Importantes

### Deprecation do lite-api.jup.ag

**`lite-api.jup.ag` será descontinuado em 31 de janeiro de 2026.**

Esta integração já está usando `https://api.jup.ag` (versão atual), então não há ação necessária.

### Header x-api-key Obrigatório

**O header `x-api-key` é OBRIGATÓRIO em todos os endpoints** (quote, swap, swap-instructions, price). Configure `JUPITER_API_KEY` para que seja enviado automaticamente.

## ✅ Chave da API Configurada

Sua chave da API Jupiter já está documentada:

```
JUPITER_API_KEY=99bf316b-8d0f-4b09-8b0e-9eab5cc6c162
```

## 📝 Passos para Configurar

### 1. Desenvolvimento Local

Crie ou edite o arquivo `.env.local` na raiz do projeto:

```bash
JUPITER_API_KEY=99bf316b-8d0f-4b09-8b0e-9eab5cc6c162
JUPITER_API_BASE=https://api.jup.ag
JUPITER_TIMEOUT_MS=15000
```

**Importante:** O arquivo `.env.local` já está no `.gitignore`, então suas chaves não serão commitadas.

### 2. Produção no Vercel

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto `bags-shield-api`
3. Vá em **Settings** → **Environment Variables**
4. Clique em **Add New**
5. Configure:
   - **Name:** `JUPITER_API_KEY`
   - **Value:** `99bf316b-8d0f-4b09-8b0e-9eab5cc6c162`
   - **Environments:** Marque Production, Preview e Development
6. Clique em **Save**

### 3. Verificar Configuração

Após configurar, teste se está funcionando:

**Localmente:**

```bash
# Inicie o servidor
pnpm dev

# Em outro terminal, teste:
curl "http://localhost:3000/api/jupiter/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000"
```

**Em produção:**

```bash
curl "https://seu-dominio.vercel.app/api/jupiter/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000"
```

**Resposta esperada (sucesso):**

```json
{
  "success": true,
  "response": {
    "outAmount": "16198753",
    "routePlan": [...],
    ...
  },
  "meta": {
    "requestId": "...",
    "upstream": "jupiter",
    "upstreamStatus": 200
  }
}
```

**Resposta de erro (não configurado):**

```json
{
  "success": false,
  "error": "jupiter_not_configured",
  "message": "JUPITER_API_KEY não está configurada..."
}
```

## 🧪 Testar Endpoints Disponíveis

### 1. Obter Cotação de Swap

```bash
curl "https://seu-dominio/api/jupiter/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000&slippageBps=50"
```

### 2. Construir Transação de Swap

```bash
curl -X POST "https://seu-dominio/api/jupiter/swap" \
  -H "Content-Type: application/json" \
  -d '{
    "quoteResponse": { ... },
    "userPublicKey": "SUA_WALLET_PUBLIC_KEY"
  }'
```

### 3. Obter Instruções de Swap

```bash
curl -X POST "https://seu-dominio/api/jupiter/swap-instructions" \
  -H "Content-Type: application/json" \
  -d '{
    "quoteResponse": { ... },
    "userPublicKey": "SUA_WALLET_PUBLIC_KEY"
  }'
```

## 📊 Monitorar Erros

Todos os erros da Jupiter são automaticamente rastreados. Para visualizar:

```bash
# Ver todos os erros da Jupiter
curl https://seu-dominio/api/errors?source=jupiter

# Ver apenas erros críticos
curl https://seu-dominio/api/errors?source=jupiter&severity=critical

# Ver erros das últimas 24 horas
curl https://seu-dominio/api/errors?source=jupiter&sinceHours=24
```

## 🔒 Segurança

- ✅ Nunca commite arquivos `.env*` no git
- ✅ Use variáveis de ambiente no Vercel para produção
- ✅ A chave da API está documentada apenas para referência
- ✅ Todos os erros são rastreados automaticamente

## 📚 Documentação Completa

Veja `JUPITER_SWAP.md` para documentação completa da integração Jupiter e exemplos de uso.
