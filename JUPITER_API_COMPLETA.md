# ✅ Integração Completa - Jupiter API (https://api.jup.ag)

## 📍 Onde se encaixa no sistema

A Jupiter API (`https://api.jup.ag`) está **totalmente integrada** ao sistema Bags Shield API para funcionalidades de **swap e preços de tokens**.

### Endpoints Integrados

| Endpoint Jupiter                  | Endpoint Bags Shield                  | Uso no Sistema                                    |
| --------------------------------- | ------------------------------------- | ------------------------------------------------- |
| `GET /swap/v1/quote`              | `GET /api/jupiter/quote`              | Obter cotações de swap para análise de risco      |
| `POST /swap/v1/swap`              | `POST /api/jupiter/swap`              | Construir transações de swap (para scan/simulate) |
| `POST /swap/v1/swap-instructions` | `POST /api/jupiter/swap-instructions` | Instruções customizadas para swap                 |
| `GET /price/v3`                   | `GET /api/jupiter/price`              | Preços USD de tokens (para análise de valor)      |

## 🔗 Integração com o Sistema

### 1. **Análise de Transações (`/api/scan`)**

- Pode usar `/api/jupiter/price` para obter valores USD dos tokens envolvidos
- Avalia swaps usando cotações de `/api/jupiter/quote`
- Calcula riscos baseados em valores monetários

### 2. **Simulação (`/api/simulate`)**

- Usa `/api/jupiter/price` para calcular impacto financeiro
- Pode simular swaps usando `/api/jupiter/quote`
- Retorna valores USD junto com shieldScore

### 3. **Rastreamento de Erros**

- Todos os erros da Jupiter são rastreados com `source: 'jupiter'`
- Visível em `/api/errors?source=jupiter`
- Estatísticas incluem contagem de erros Jupiter

## 🎯 Casos de Uso

### Caso 1: Analisar Swap Antes de Executar

```bash
# 1. Obter cotação
GET /api/jupiter/quote?inputMint=...&outputMint=...&amount=...

# 2. Obter preços para contexto
GET /api/jupiter/price?ids=...mint1,mint2

# 3. Escanear transação (usa preços para análise)
POST /api/scan
Body: { rawTransaction: "..." }

# 4. Simular impacto
POST /api/simulate
Body: { mint: "..." }
```

### Caso 2: Construir Swap Seguro

```bash
# 1. Obter cotação
GET /api/jupiter/quote?inputMint=SOL&outputMint=USDC&amount=100000000

# 2. Construir transação
POST /api/jupiter/swap
Body: { quoteResponse: {...}, userPublicKey: "..." }

# 3. Escanear antes de assinar
POST /api/scan
Body: { rawTransaction: response.swapTransaction }

# 4. Aplicar decisão
POST /api/apply
```

## ✅ Status da Integração

- ✅ **Swap API** - Quote, Swap, Instructions
- ✅ **Price API V3** - Preços USD de tokens
- ✅ **Rastreamento de Erros** - Integrado
- ✅ **Testes Automatizados** - Incluídos
- ✅ **Documentação** - Completa
- ✅ **Chave API** - Configurada: `99bf316b-8d0f-4b09-8b0e-9eab5cc6c162`

## 📊 Fluxo Completo Integrado

```
Cliente → GET /api/jupiter/quote → Cotação
       ↓
       → GET /api/jupiter/price → Preços USD
       ↓
       → POST /api/scan → Análise de Risco (usa preços)
       ↓
       → POST /api/jupiter/swap → Transação (se aprovado)
       ↓
       → POST /api/apply → Decisão Final
```

Todos os endpoints retornam **200** quando configurados corretamente e estão totalmente integrados ao sistema de rastreamento de erros e contrato padronizado (`success`, `response`, `meta`).
