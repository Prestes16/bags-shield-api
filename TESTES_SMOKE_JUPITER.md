# 🔥 Testes Smoke - Jupiter API

## Objetivo

Validar **funcionalidade e compatibilidade** de todos os endpoints da Jupiter API. Todos devem retornar **200** quando configurados corretamente.

## ⚠️ Importante

### Endpoints Corretos (v1, não v6)

**❌ NÃO USE:**
- `https://quote-api.jup.ag/v6` (deprecated)
- `/v6/quote` ou `/v6/swap` (versões antigas)

**✅ USE:**
- `https://api.jup.ag/swap/v1/quote`
- `https://api.jup.ag/swap/v1/swap`
- `https://api.jup.ag/price/v3`

### Header x-api-key Obrigatório

**O header `x-api-key` é OBRIGATÓRIO em todos os endpoints** (quote, swap, swap-instructions, price).

## Endpoints Testados

| # | Endpoint | Método | Descrição | Status Esperado |
|---|----------|--------|-----------|-----------------|
| 1 | `/swap/v1/quote` | GET | Cotação de swap (SOL -> USDC) | 200 |
| 2 | `/swap/v1/swap` | POST | Construir transação de swap | 200 |
| 3 | `/price/v3` | GET | Preços USD de tokens | 200 |

## Pré-requisitos

1. **JUPITER_API_KEY configurada** em `.env.local` ou variáveis de ambiente
2. **Node.js** instalado (para executar o script)

## Como Executar

### Executar testes smoke diretamente

```bash
node scripts/test-jupiter-smoke.mjs
# ou
pnpm test:jupiter:smoke
```

### Com dotenv (opcional)

Se você tiver `dotenv` instalado, o script tentará carregar `.env.local` automaticamente:

```bash
npm install dotenv  # se ainda não tiver
node scripts/test-jupiter-smoke.mjs
```

## Resultado Esperado

### ✅ Sucesso (Todos os endpoints funcionais)

```
🪐 TESTES SMOKE - JUPITER API
📡 Base URL: https://api.jup.ag
🔑 API Key: ***c162

1️⃣ Testando GET /swap/v1/quote (SOL -> USDC)...
✅ GET /swap/v1/quote -> 200 (outAmount=16198753)
   Price Impact: 0%

2️⃣ Testando POST /swap/v1/swap (Gerar Transação)...
✅ POST /swap/v1/swap -> 200 (TX gerada (1234 chars))
   Last Valid Block Height: 299283763

3️⃣ Testando GET /price/v3 (Preços USD)...
✅ GET /price/v3 -> 200 (2 preços obtidos)
   SOL: $147.47
   USDC: $1.0

============================================================
📊 RESULTADO: 3/3 testes passaram
============================================================

✅ Compatibilidade: 3/3 endpoints funcionais
```

### ⚠️ Aviso (API não configurada)

```
⚠️  AVISO: JUPITER_API_KEY não está configurada!
   Configure em .env.local ou variáveis de ambiente.
```

### ❌ Erro (API key inválida)

```
❌ GET /swap/v1/quote -> 401 (x-api-key inválido ou ausente)
```

**Solução:** Verifique se `JUPITER_API_KEY` está correta em `.env.local`.

## Validações Realizadas

### 1. **Status HTTP**
- Todos os endpoints devem retornar `200` quando configurados
- `401` ou `403` indica que `x-api-key` está ausente ou inválida
- `400` indica parâmetros inválidos (mas endpoint está funcional)
- `0` ou `CONNECTION_ERROR` indica erro de rede

### 2. **Funcionalidade**
- **Quote**: Obtém cotação SOL -> USDC e valida `outAmount`
- **Swap**: Gera transação usando quote válida e valida `swapTransaction`
- **Price**: Obtém preços USD e valida estrutura de resposta

### 3. **Headers**
- Verifica que `x-api-key` está sendo enviado
- Valida Content-Type correto

## Testes Manuais Rápidos

### Teste 1: Cotação (Quote)

```bash
curl "https://api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000&slippageBps=50" \
  -H "x-api-key: SUA_API_KEY"
```

### Teste 2: Preços (Price)

```bash
curl "https://api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" \
  -H "x-api-key: SUA_API_KEY"
```

## Integração com CI/CD

Os testes smoke podem ser integrados em pipelines de CI/CD:

```yaml
# Exemplo GitHub Actions
- name: Test Jupiter API Smoke
  env:
    JUPITER_API_KEY: ${{ secrets.JUPITER_API_KEY }}
  run: pnpm test:jupiter:smoke
```

## Troubleshooting

### Problema: Todos os testes retornam 401/403
**Causa:** `JUPITER_API_KEY` não está configurada ou está inválida  
**Solução:** Configure `JUPITER_API_KEY` em `.env.local` ou variáveis de ambiente

### Problema: Teste de swap falha com 400
**Causa:** Quote expirada ou parâmetros inválidos  
**Solução:** Normal - o teste obtém uma nova quote antes de tentar o swap

### Problema: Erro "Cannot find module 'dotenv'"
**Causa:** dotenv não está instalado  
**Solução:** O script funciona sem dotenv usando `process.env`. Se quiser, instale: `npm install dotenv`

### Problema: Testes retornam erro de rede
**Causa:** Sem conexão com internet ou Jupiter API offline  
**Solução:** Verifique sua conexão e status da Jupiter API: https://status.jup.ag/

## Status da Jupiter API

Após executar os testes, você terá uma visão clara:

- ✅ **3/3 passaram** → API totalmente funcional
- ⚠️ **Alguns falharam com 401/403** → Configure `JUPITER_API_KEY`
- ❌ **Todos falharam com erro de rede** → Verifique conexão e status da API
- ⚠️ **Alguns falharam com 400** → Verifique logs e parâmetros

## Próximos Passos

1. Execute `pnpm test:jupiter:smoke` regularmente
2. Integre em CI/CD para validação contínua
3. Use os testes manuais para debug rápido
4. Monitore `/api/errors?source=jupiter` para erros rastreados

## Notas Técnicas

- **Versão da API**: v1 (Swap), v3 (Price)
- **Base URL**: `https://api.jup.ag` (não `quote-api.jup.ag` ou `lite-api.jup.ag`)
- **Autenticação**: Header `x-api-key` obrigatório
- **Timeout**: 15 segundos por padrão
