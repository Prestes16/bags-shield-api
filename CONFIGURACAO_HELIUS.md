# Configuração Rápida - Helius API

## ✅ Chave da API Configurada

Sua chave da API Helius já está documentada:

```
HELIUS_API_KEY=b472996c-2166-4f29-8e41-c06251e6ee3c
```

## 📝 Passos para Configurar

### 1. Desenvolvimento Local

Crie ou edite o arquivo `.env.local` na raiz do projeto:

```bash
HELIUS_API_KEY=b472996c-2166-4f29-8e41-c06251e6ee3c
HELIUS_BASE_URL=https://api.helius.xyz
HELIUS_TIMEOUT_MS=15000
```

**Importante:** O arquivo `.env.local` já está no `.gitignore`, então suas chaves não serão commitadas.

### 2. Produção no Vercel

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto `bags-shield-api`
3. Vá em **Settings** → **Environment Variables**
4. Clique em **Add New**
5. Configure:
   - **Name:** `HELIUS_API_KEY`
   - **Value:** `b472996c-2166-4f29-8e41-c06251e6ee3c`
   - **Environments:** Marque Production, Preview e Development
6. Clique em **Save**

### 3. Verificar Configuração

Após configurar, teste se está funcionando:

**Localmente:**

```bash
# Inicie o servidor
npm run dev

# Em outro terminal, teste:
curl http://localhost:3000/api/helius/slot
```

**Em produção:**

```bash
curl https://seu-dominio.vercel.app/api/helius/slot
```

**Resposta esperada (sucesso):**

```json
{
  "success": true,
  "response": {
    "slot": 123456789
  },
  "meta": {
    "requestId": "...",
    "upstream": "helius",
    "upstreamStatus": 200
  }
}
```

**Resposta de erro (não configurado):**

```json
{
  "success": false,
  "error": "helius_not_configured",
  "message": "HELIUS_API_KEY não está configurada..."
}
```

## 🧪 Testar Endpoints Disponíveis

### 1. Obter Slot Atual

```bash
curl https://seu-dominio/api/helius/slot
```

### 2. Obter Saldo de uma Conta

```bash
curl -X POST https://seu-dominio/api/helius/balance \
  -H "Content-Type: application/json" \
  -d '{
    "address": "sua_wallet_address_aqui"
  }'
```

### 3. Simular Transação

```bash
curl -X POST https://seu-dominio/api/helius/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "transaction": "base64_encoded_transaction"
  }'
```

### 4. Obter Informações de Transação

```bash
curl -X POST https://seu-dominio/api/helius/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "signature": "signature_da_transacao"
  }'
```

## 📊 Monitorar Erros

Todos os erros da Helius são automaticamente rastreados. Para visualizar:

```bash
# Ver todos os erros da Helius
curl https://seu-dominio/api/errors?source=helius

# Ver apenas erros críticos
curl https://seu-dominio/api/errors?source=helius&severity=critical

# Ver erros das últimas 24 horas
curl https://seu-dominio/api/errors?source=helius&sinceHours=24
```

## 🔒 Segurança

- ✅ Nunca commite arquivos `.env*` no git
- ✅ Use variáveis de ambiente no Vercel para produção
- ✅ A chave da API está documentada apenas para referência
- ✅ Todos os erros são rastreados automaticamente

## 📚 Documentação Completa

Veja `RASTREAMENTO_ERROS_HELIUS.md` para documentação completa do sistema de rastreamento de erros e integração Helius.
