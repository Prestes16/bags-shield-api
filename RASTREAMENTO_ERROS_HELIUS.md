# Sistema de Rastreamento de Erros e Integrações (Helius + Jupiter)

## Visão Geral

Foi implementado um sistema completo de rastreamento de erros que captura e registra erros de todas as fontes, incluindo integrações com:
- **Helius API** - RPC e Enhanced Transactions para Solana
- **Jupiter API** - Swap aggregator para Solana

## Componentes Implementados

### 1. Módulo de Rastreamento de Erros (`lib/error-tracking.ts`)

Sistema centralizado que:

- Rastreia erros com contexto completo (requestId, endpoint, source, metadata)
- Classifica erros por severidade (low, medium, high, critical)
- Mantém histórico de erros em memória (até 1000 erros)
- Fornece estatísticas e filtros para análise
- Suporta marcação de erros como resolvidos

**Funcionalidades principais:**

- `trackError()` - Rastreia qualquer erro genérico
- `trackHeliusError()` - Rastreia especificamente erros da Helius API
- `getErrors()` - Obtém erros com filtros
- `getHeliusErrors()` - Obtém apenas erros da Helius
- `getStats()` - Estatísticas de erros
- `markResolved()` - Marca erro como resolvido

### 2. Cliente Helius API (`lib/helius.ts`)

Cliente completo para integração com Helius que fornece:

- Simulação de transações Solana
- Obtenção de informações de transações
- Consulta de informações de contas
- Obtenção de saldos
- Consulta de slots e blocos

**Métodos disponíveis:**

- `simulateTransaction()` - Simula uma transação
- `getTransaction()` - Obtém uma transação por signature
- `getTransactions()` - Obtém múltiplas transações
- `getAccountInfo()` - Informações de uma conta
- `getBalance()` - Saldo de uma conta
- `getSlot()` - Slot atual da blockchain
- `getBlock()` - Informações de um bloco

**Configuração:**

- `HELIUS_API_KEY` - Chave da API Helius (obrigatória)
- `HELIUS_API_BASE` - Base da Enhanced API (padrão: https://api-mainnet.helius-rpc.com)
- `HELIUS_RPC_URL` - URL do RPC Solana (padrão: https://mainnet.helius-rpc.com)
- `HELIUS_TIMEOUT_MS` - Timeout em ms (padrão: 15000)

**URLs oficiais Helius (mainnet):**

- Analisar transação(ões): `POST https://api-mainnet.helius-rpc.com/v0/transactions/?api-key=...`
- Histórico por endereço: `GET https://api-mainnet.helius-rpc.com/v0/addresses/{address}/transactions/?api-key=...`
- RPC: `https://mainnet.helius-rpc.com/?api-key=...`

### 3. Endpoint Helius API (`api/helius/[...route].ts`)

Endpoints REST para acessar funcionalidades da Helius:

**Enhanced Transactions API (analisar e histórico):**

- `POST /api/helius/parse-transactions` - Analisar transação(ões) (body: `{ "transactions": ["sig1", "sig2"] }`)
- `GET /api/helius/address-transactions?address=...` - Histórico de transações de um endereço
- `GET /api/helius/addresses/{address}/transactions` - Histórico por path (query: limit, before, after, type, source, etc.)

**RPC (Solana):**

- `POST /api/helius/simulate` - Simula transação
- `POST /api/helius/transaction` - Obtém transação
- `POST /api/helius/transactions` - Obtém múltiplas transações
- `POST /api/helius/account` - Informações de conta
- `POST /api/helius/balance` - Saldo de conta
- `GET /api/helius/slot` - Slot atual
- `POST /api/helius/block` - Informações de bloco

Todos os endpoints incluem rastreamento automático de erros.

### 4. Endpoint de Visualização de Erros (`api/errors.ts`)

Endpoint para visualizar erros rastreados:

**GET /api/errors**

Query parameters:

- `source` - Filtrar por fonte (helius, bags, scan, simulate, etc.)
- `severity` - Filtrar por severidade (low, medium, high, critical)
- `resolved` - Filtrar por status (true/false)
- `limit` - Limite de resultados (padrão: 100, máximo: 500)
- `sinceHours` - Erros desde X horas atrás

**Exemplo:**

```
GET /api/errors?source=helius&severity=high&limit=50&sinceHours=24
```

### 5. Cliente Jupiter API (`lib/jupiter.ts`)

Cliente completo para integração com Jupiter Swap API que fornece:

- Obtenção de cotações de swap entre tokens
- Construção de transações de swap serializadas
- Obtenção de instruções de swap para construção customizada

**Métodos disponíveis:**

- `getQuote()` - Obtém cotação de swap (GET /swap/v1/quote)
- `buildSwapTransaction()` - Constrói transação serializada (POST /swap/v1/swap)
- `buildSwapInstructions()` - Obtém instruções (POST /swap/v1/swap-instructions)

**Configuração:**

- `JUPITER_API_KEY` - Chave da API Jupiter (obrigatória)
- `JUPITER_API_BASE` - URL base (padrão: https://api.jup.ag)
- `JUPITER_TIMEOUT_MS` - Timeout em ms (padrão: 15000)

### 6. Endpoint Jupiter API (`api/jupiter/[...route].ts`)

Endpoints REST para funcionalidades de swap:

- `GET /api/jupiter/quote` - Obter cotação de swap
- `POST /api/jupiter/swap` - Construir transação de swap
- `POST /api/jupiter/swap-instructions` - Obter instruções de swap

Todos os endpoints incluem rastreamento automático de erros.

### 7. Integração em Todas as APIs

O rastreamento de erros foi integrado em todas as APIs existentes:

- ✅ `api/scan.ts` - Rastreamento de erros no scan
- ✅ `api/simulate.ts` - Rastreamento de erros na simulação
- ✅ `api/apply.ts` - Rastreamento de erros no apply
- ✅ `api/bags/[...route].ts` - Rastreamento de erros nas rotas Bags
- ✅ `api/ai/image.ts` - Rastreamento de erros na geração de imagens
- ✅ `api/webhooks/vercel.ts` - Rastreamento de erros em webhooks
- ✅ `api/helius/[...route].ts` - Rastreamento específico para Helius
- ✅ `api/jupiter/[...route].ts` - Rastreamento específico para Jupiter

## Como Usar

### 1. Configurar APIs

#### Helius API

**Para desenvolvimento local:**

Adicione a variável de ambiente no arquivo `.env.local` (ou `.env`):

```bash
HELIUS_API_KEY=b472996c-2166-4f29-8e41-c06251e6ee3c
```

Opcionalmente, configure também:

```bash
HELIUS_API_BASE=https://api-mainnet.helius-rpc.com
HELIUS_RPC_URL=https://mainnet.helius-rpc.com
HELIUS_TIMEOUT_MS=15000
```

**Para produção no Vercel:**

1. Acesse o dashboard do Vercel
2. Vá em Settings → Environment Variables
3. Adicione `HELIUS_API_KEY` com o valor: `b472996c-2166-4f29-8e41-c06251e6ee3c`
4. Selecione os ambientes (Production, Preview, Development)
5. Clique em Save

**Verificar configuração:**

Após configurar, você pode verificar se está funcionando:

```bash
# Verificar se a API está configurada (deve retornar slot atual)
curl https://seu-dominio/api/helius/slot
```

Se retornar erro `helius_not_configured`, a variável de ambiente não foi configurada corretamente.

#### Jupiter API

**Para desenvolvimento local:**

Adicione a variável de ambiente no arquivo `.env.local` (ou `.env`):

```bash
JUPITER_API_KEY=99bf316b-8d0f-4b09-8b0e-9eab5cc6c162
```

Opcionalmente, configure também:

```bash
JUPITER_API_BASE=https://api.jup.ag
JUPITER_TIMEOUT_MS=15000
```

**Para produção no Vercel:**

1. Acesse o dashboard do Vercel
2. Vá em Settings → Environment Variables
3. Adicione `JUPITER_API_KEY` com o valor: `99bf316b-8d0f-4b09-8b0e-9eab5cc6c162`
4. Selecione os ambientes (Production, Preview, Development)
5. Clique em Save

**Verificar configuração:**

Após configurar, você pode verificar se está funcionando:
```bash
# Verificar se a API está configurada (deve retornar cotação)
curl https://seu-dominio/api/jupiter/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000
```

Se retornar erro `jupiter_not_configured`, a variável de ambiente não foi configurada corretamente.

### 2. Usar APIs

**Exemplo: Simular transação**

```bash
curl -X POST https://seu-dominio/api/helius/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "transaction": "base64_encoded_transaction"
  }'
```

**Exemplo: Obter saldo**

```bash
curl -X POST https://seu-dominio/api/helius/balance \
  -H "Content-Type: application/json" \
  -d '{
    "address": "sua_wallet_address"
  }'
```

#### Jupiter API

**Exemplo: Obter cotação de swap**
```bash
curl https://seu-dominio/api/jupiter/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000
```

**Exemplo: Construir transação de swap**
```bash
curl -X POST https://seu-dominio/api/jupiter/swap \
  -H "Content-Type: application/json" \
  -d '{
    "quoteResponse": { ... },
    "userPublicKey": "WALLET_ADDRESS"
  }'
```

### 3. Visualizar Erros Rastreados

**Todos os erros da Helius:**

```bash
curl https://seu-dominio/api/errors?source=helius
```

**Erros críticos das últimas 24 horas:**

```bash
curl https://seu-dominio/api/errors?severity=critical&sinceHours=24
```

**Estatísticas:**

```bash
curl https://seu-dominio/api/errors?limit=0
# Retorna apenas as estatísticas
```

### 4. Usar Programaticamente

```typescript
import { heliusClient } from '../lib/helius';
import { errorTracker } from '../lib/error-tracking';

// Helius: Simular transação
try {
  const result = await heliusClient.simulateTransaction(transactionBase64, { replaceRecentBlockhash: true }, requestId);
} catch (error) {
  // Erro já foi rastreado automaticamente
  console.error('Erro ao simular:', error);
}

// Jupiter: Obter cotação e construir swap
try {
  const quote = await jupiterClient.getQuote({
    inputMint: 'So11111111111111111111111111111111111111112',
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    amount: '100000000',
    slippageBps: 50,
  }, requestId);
  
  const swapTx = await jupiterClient.buildSwapTransaction({
    quoteResponse: quote,
    userPublicKey: walletAddress,
  }, requestId);
} catch (error) {
  // Erro já foi rastreado automaticamente
  console.error('Erro no swap:', error);
}

// Ver erros
const heliusErrors = errorTracker.getHeliusErrors();
const jupiterErrors = errorTracker.getErrors({ source: 'jupiter' });
const stats = errorTracker.getStats();
console.log('Estatísticas:', stats);
```

## Estrutura de Erros Rastreados

Cada erro rastreado contém:

```typescript
{
  id: string;                    // ID único do erro
  timestamp: string;              // ISO timestamp
  error: {
    message: string;              // Mensagem do erro
    code?: string;                // Código do erro (se disponível)
    stack?: string;               // Stack trace
    name?: string;                // Nome do erro
  };
  context: {
    requestId?: string;           // ID da requisição
    endpoint?: string;            // Endpoint da API
    method?: string;              // Método HTTP
    source?: string;              // Fonte (helius, bags, etc.)
    userId?: string;              // ID do usuário (se disponível)
    wallet?: string;              // Wallet address (se disponível)
    network?: string;            // Network (mainnet, devnet, etc.)
    metadata?: Record<string, any>; // Metadados adicionais
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;              // Se o erro foi resolvido
}
```

## Logs e Monitoramento

Todos os erros são logados no console com:

- Nível apropriado (error para críticos/altos, warn para outros)
- Contexto estruturado
- Metadados relevantes

Erros da Helius e Jupiter recebem log adicional com stack trace completo.

## Limpeza Automática

O sistema mantém apenas os últimos 1000 erros em memória. Para limpar erros antigos manualmente:

```typescript
const removed = errorTracker.cleanup(24); // Remove erros com mais de 24 horas
console.log(`Removidos ${removed} erros antigos`);
```

## Próximos Passos Sugeridos

1. **Persistência**: Adicionar armazenamento persistente (banco de dados) para erros
2. **Alertas**: Integrar com serviços de alerta (Sentry, PagerDuty, etc.)
3. **Dashboard**: Criar interface web para visualizar erros
4. **Métricas**: Adicionar métricas de performance e taxa de erro
5. **Rate Limiting**: Adicionar rate limiting específico para Helius API

## Notas Importantes

- O rastreamento de erros é em memória e será perdido ao reiniciar o servidor
- Para produção, considere adicionar persistência
- Erros críticos da Helius são sempre logados com stack trace completo
- O sistema não expõe informações sensíveis nos logs
- Todos os erros incluem `requestId` para rastreamento completo
