# 🔥 Testes Smoke - API Helius

## Objetivo

Validar **funcionalidade e compatibilidade** de todos os endpoints da API Helius. Todos devem retornar **200** quando configurados corretamente.

## Endpoints Testados

| #   | Endpoint                                       | Método | Descrição                          | Status Esperado |
| --- | ---------------------------------------------- | ------ | ---------------------------------- | --------------- |
| 1   | `/api/helius/slot`                             | GET    | Obter slot atual (RPC)             | 200             |
| 2   | `/api/helius/balance`                          | POST   | Obter saldo de conta               | 200             |
| 3   | `/api/helius/account`                          | POST   | Obter informações da conta         | 200             |
| 4   | `/api/helius/block`                            | POST   | Obter informações de bloco         | 200             |
| 5   | `/api/helius/transaction`                      | POST   | Obter transação por signature      | 200             |
| 6   | `/api/helius/transactions`                     | POST   | Obter múltiplas transações         | 200             |
| 7   | `/api/helius/simulate`                         | POST   | Simular transação                  | 200             |
| 8   | `/api/helius/parse-transactions`               | POST   | Analisar transações (Enhanced API) | 200             |
| 9   | `/api/helius/address-transactions`             | GET    | Histórico por endereço (query)     | 200             |
| 10  | `/api/helius/addresses/{address}/transactions` | GET    | Histórico por endereço (path)      | 200             |

## Pré-requisitos

1. **HELIUS_API_KEY configurada** em `.env.local` ou variáveis de ambiente
2. **Servidor rodando** (`pnpm dev` ou `pnpm start`)

## Verificação Rápida do .env.local (PowerShell)

Para validar RPC e Enhanced API **sem subir o servidor**, use o script que lê `.env.local` e testa as URLs:

```powershell
# Na raiz do projeto (bags-shield-api)
.\scripts\verify-helius-env.ps1
```

**Requisitos no `.env.local`:**

- `HELIUS_API_KEY` – chave da API
- `HELIUS_RPC_URL` – base do RPC (ex: `https://mainnet.helius-rpc.com`)
- `HELIUS_API_BASE` ou `HELIUS_ENHANCED_API_BASE` – base da Enhanced API (ex: `https://api-mainnet.helius-rpc.com`)

O script monta as URLs com `api-key` (como o código faz), testa **getHealth** no RPC e um **GET** na Enhanced API (`/v0/addresses/.../transactions`), e exibe headers e primeiros bytes do body (sanitizado).

**Formato do bags-shield-app:** se o seu `.env.local` usa `HELIUS_RPC_URL` com `api-key` na URL e `HELIUS_ENHANCED_API_BASE`, use o script equivalente que testa `/v0/webhooks`:

```powershell
.\scripts\verify-helius-env-app-style.ps1
```

(Execute na raiz do projeto onde está o `.env.local` no formato do app.)

## Como Executar (testes smoke com servidor)

### 1. Iniciar o servidor (em um terminal)

```bash
pnpm dev
# ou
pnpm start
```

### 2. Executar testes smoke (em outro terminal)

```bash
pnpm test:helius:smoke
# ou
node scripts/test-helius-smoke.mjs
```

### 3. Executar com URL customizada

```bash
BASE_URL=https://seu-dominio.vercel.app pnpm test:helius:smoke
```

## Resultado Esperado

### ✅ Sucesso (Todos os endpoints funcionais)

```
🔥 TESTES SMOKE - API HELIUS 🔥

Base URL: http://localhost:3000

✅ GET /api/helius/slot -> 200 (slot=123456789)
✅ POST /api/helius/balance -> 200 (balance=1000000000)
✅ POST /api/helius/account -> 200 (conta obtida)
✅ POST /api/helius/block -> 200 (bloco obtido (slot 123456789))
✅ POST /api/helius/transaction -> 200 (endpoint funcional)
✅ POST /api/helius/transactions -> 200 (endpoint funcional)
✅ POST /api/helius/simulate -> 200 (endpoint funcional (transação inválida esperada))
✅ POST /api/helius/parse-transactions -> 200 (Enhanced API funcional)
✅ GET /api/helius/address-transactions -> 200 (histórico obtido)
✅ GET /api/helius/addresses/{address}/transactions -> 200 (histórico por path obtido)

============================================================
📊 RESULTADO: 10/10 testes passaram
============================================================

✅ Compatibilidade: 10/10 endpoints funcionais
```

### ⚠️ Aviso (API não configurada)

```
⚠️  AVISO: HELIUS_API_KEY não está configurada!
   Configure a variável de ambiente para executar testes completos.
```

### ❌ Erro (Servidor não está rodando)

```
❌ GET /api/helius/slot -> CONNECTION_ERROR (erro desconhecido)
```

**Solução:** Inicie o servidor com `pnpm dev` antes de executar os testes.

## Validações Realizadas

### 1. **Status HTTP**

- Todos os endpoints devem retornar `200` quando configurados
- `501` indica que `HELIUS_API_KEY` não está configurada
- `400` indica parâmetros inválidos (mas endpoint está funcional)
- `0` ou `CONNECTION_ERROR` indica servidor não está rodando

### 2. **Contrato de Resposta**

- `success: true` quando operação bem-sucedida
- `response` contém dados da resposta
- `meta` contém metadados (requestId, upstream, etc.)

### 3. **Funcionalidade**

- RPC endpoints (slot, balance, account, block, transaction, transactions, simulate)
- Enhanced Transactions API (parse-transactions, address-transactions)
- Validação de parâmetros
- Tratamento de erros

## Testes Manuais Rápidos

### Teste 1: Slot atual

```bash
curl "http://localhost:3000/api/helius/slot"
```

### Teste 2: Saldo de conta

```bash
curl -X POST "http://localhost:3000/api/helius/balance" \
  -H "Content-Type: application/json" \
  -d '{"address":"11111111111111111111111111111111"}'
```

### Teste 3: Histórico de transações

```bash
curl "http://localhost:3000/api/helius/address-transactions?address=11111111111111111111111111111111&limit=10"
```

## Integração com CI/CD

Os testes smoke podem ser integrados em pipelines de CI/CD:

```yaml
# Exemplo GitHub Actions
- name: Test Helius API Smoke
  run: |
    pnpm dev &
    sleep 10
    pnpm test:helius:smoke
```

## Troubleshooting

### Problema: Todos os testes retornam 501

**Causa:** `HELIUS_API_KEY` não está configurada  
**Solução:** Configure `HELIUS_API_KEY` em `.env.local` ou variáveis de ambiente

### Problema: Todos os testes retornam CONNECTION_ERROR

**Causa:** Servidor não está rodando  
**Solução:** Execute `pnpm dev` antes dos testes

### Problema: Alguns testes retornam 400

**Causa:** Parâmetros inválidos (normal para alguns casos)  
**Solução:** Verifique se os dados de teste são válidos (endereços, signatures, etc.)

### Problema: Testes retornam 500

**Causa:** Erro interno da API Helius ou configuração incorreta  
**Solução:** Verifique logs do servidor e configuração da API key

## Status da API Helius

Após executar os testes, você terá uma visão clara:

- ✅ **10/10 passaram** → API totalmente funcional
- ⚠️ **Alguns falharam com 501** → Configure `HELIUS_API_KEY`
- ❌ **Todos falharam com CONNECTION_ERROR** → Inicie o servidor
- ⚠️ **Alguns falharam com 400/500** → Verifique logs e configuração

## Próximos Passos

1. Execute `pnpm test:helius:smoke` regularmente
2. Integre em CI/CD para validação contínua
3. Use os testes manuais para debug rápido
4. Monitore `/api/errors?source=helius` para erros rastreados
