# Integração Jupiter API – Swap

## Visão Geral

Integração completa com **Jupiter API** para funcionalidades de swap na Solana. Jupiter é um agregador de DEXes que encontra as melhores rotas de swap através de múltiplos mercados.

## ⚠️ Avisos Importantes

### Deprecation do lite-api.jup.ag

**`lite-api.jup.ag` será descontinuado em 31 de janeiro de 2026.**

Esta integração já está usando `https://api.jup.ag` (versão atual), então não há ação necessária. Se você estiver usando `lite-api.jup.ag` em outro lugar, migre para `api.jup.ag` antes da data de deprecation.

### Header x-api-key Obrigatório

**O header `x-api-key` é OBRIGATÓRIO em todos os endpoints** (quote, swap, swap-instructions, price).

- ✅ Sempre enviado automaticamente quando `JUPITER_API_KEY` está configurada
- ❌ Requisições sem `x-api-key` falharão
- ⚠️ Configure `JUPITER_API_KEY` em `.env.local` ou variáveis de ambiente

## Configuração

### Variáveis de Ambiente

```bash
JUPITER_API_KEY=99bf316b-8d0f-4b09-8b0e-9eab5cc6c162
JUPITER_API_BASE=https://api.jup.ag
JUPITER_TIMEOUT_MS=15000
```

**Obtenha sua chave:** https://portal.jup.ag/

## Endpoints Disponíveis

### 1. GET /api/jupiter/quote

Obter cotação de swap entre dois tokens.

**Query Parameters:**

**Obrigatórios:**

- `inputMint` - Mint do token de entrada (ex: `So11111111111111111111111111111111111111112` para SOL)
- `outputMint` - Mint do token de saída (ex: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` para USDC)
- `amount` - Quantidade em raw amount (lamports para SOL, atomic units para outros)

**Opcionais (básicos):**

- `slippageBps` - Basis points de slippage (padrão: 50 = 0.5%)
- `restrictIntermediateTokens` - true para usar apenas tokens intermediários líquidos (padrão: true)
- `onlyDirectRoutes` - true para rotas diretas apenas (1 mercado)
- `maxAccounts` - Limite de contas (padrão: 64, recomendado: 64)
- `asLegacyTransaction` - true para transações legacy (sem versioned)
- `platformFeeBps` - Fee do integrador em basis points
- `feeAccount` - Conta para receber fees

**Opcionais (úteis em casos reais):**

- `swapMode` - `'ExactIn'` (padrão) ou `'ExactOut'` (para quantidade exata de saída)
- `dexes` - Array de DEXes para incluir (ex: `['Raydium', 'Orca']`)
- `excludeDexes` - Array de DEXes para excluir
- `instructionVersion` - Versão da instrução (`0` = legacy, `1` = versioned)

**Nota:** `dynamicSlippage` **não** é aplicável no `/quote` - ele só funciona no `/swap`.

**Exemplos:**

```bash
# Básico
curl "http://localhost:3000/api/jupiter/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000&slippageBps=50"

# Com swapMode ExactOut (quantidade exata de saída)
curl "http://localhost:3000/api/jupiter/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000&swapMode=ExactOut"

# Excluindo DEXes específicas
curl "http://localhost:3000/api/jupiter/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000&excludeDexes=Raydium,Orca"
```

**Resposta (200):**

```json
{
  "success": true,
  "response": {
    "inputMint": "So11111111111111111111111111111111111111112",
    "inAmount": "100000000",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "outAmount": "16198753",
    "priceImpactPct": "0",
    "routePlan": [...],
    "contextSlot": 299283763
  },
  "meta": {
    "requestId": "...",
    "upstream": "jupiter",
    "upstreamStatus": 200
  }
}
```

### 2. POST /api/jupiter/swap

Construir transação de swap serializada (pronta para assinar e enviar).

**Body:**

```json
{
  "quoteResponse": { ... }, // Resposta do endpoint /quote
  "userPublicKey": "WALLET_PUBLIC_KEY",
  "dynamicComputeUnitLimit": true, // Opcional, padrão: true
  "dynamicSlippage": true, // Opcional, padrão: true
  "wrapAndUnwrapSol": true, // Opcional, padrão: true
  "prioritizationFeeLamports": { // Opcional
    "priorityLevelWithMaxLamports": {
      "maxLamports": 1000000,
      "priorityLevel": "veryHigh"
    }
  }
}
```

**Exemplo:**

```bash
curl -X POST "http://localhost:3000/api/jupiter/swap" \
  -H "Content-Type: application/json" \
  -d '{
    "quoteResponse": { ... },
    "userPublicKey": "86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY",
    "dynamicComputeUnitLimit": true,
    "dynamicSlippage": true
  }'
```

**Resposta (200):**

```json
{
  "success": true,
  "response": {
    "swapTransaction": "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA...",
    "lastValidBlockHeight": 279632475,
    "prioritizationFeeLamports": 9999,
    "computeUnitLimit": 388876
  },
  "meta": {
    "requestId": "...",
    "upstream": "jupiter",
    "upstreamStatus": 200
  }
}
```

### 3. POST /api/jupiter/swap-instructions

Obter instruções de swap (sem transação serializada) para construir sua própria transação.

**Body:** Mesmo que `/swap`, mas retorna instruções ao invés de transação serializada.

### 4. GET /api/jupiter/price

Obter preços USD de tokens (Price API V3).

**Query Parameters:**

- `ids` (obrigatório) - Mint addresses separados por vírgula (máximo 50)

**Exemplo:**

```bash
curl "http://localhost:3000/api/jupiter/price?ids=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
```

**Resposta (200):**

```json
{
  "success": true,
  "response": {
    "So11111111111111111111111111111111111111112": {
      "usdPrice": 147.47,
      "blockId": 348004023,
      "decimals": 9,
      "priceChange24h": 1.29
    },
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": {
      "usdPrice": 1.0,
      "blockId": 348004026,
      "decimals": 6,
      "priceChange24h": 0.0
    }
  },
  "meta": {
    "requestId": "...",
    "upstream": "jupiter",
    "upstreamStatus": 200,
    "count": 2
  }
}
```

## Fluxo Completo de Swap

1. **Obter cotação:**

   ```bash
   GET /api/jupiter/quote?inputMint=...&outputMint=...&amount=...
   ```

2. **Construir transação:**

   ```bash
   POST /api/jupiter/swap
   Body: { quoteResponse: {...}, userPublicKey: "..." }
   ```

3. **Assinar e enviar:**
   - Use `response.swapTransaction` (base64)
   - Deserialize, assine com a wallet do usuário
   - Envie para a rede Solana

## Tokens Comuns (Mints)

- **SOL:** `So11111111111111111111111111111111111111112`
- **USDC:** `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **USDT:** `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`

## Rastreamento de Erros

Todos os erros da Jupiter são automaticamente rastreados com:

- Contexto completo (requestId, endpoint, parâmetros)
- Severidade apropriada
- Integração com `/api/errors?source=jupiter`

## Testes

**Automático:**

```bash
pnpm test:api  # Inclui testes Jupiter
```

**Manual:**
Veja exemplos em `TESTES_MANUAIS.md` seção 9 e 10.

## Documentação Oficial

- [Jupiter API Docs](https://dev.jup.ag/docs/swap-api/get-quote)
- [Portal Jupiter](https://portal.jup.ag/)
