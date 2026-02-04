# Jupiter Swap Client Implementation

## ⚠️ IMPORTANTE: Migração de V6 para V1

**Jupiter V6 está DEPRECATED.** Esta implementação usa **Jupiter API V1** (`/swap/v1/`).

### Mudanças Principais

| V6 (Deprecated)               | V1 (Atual)                    |
| ----------------------------- | ----------------------------- |
| `https://quote-api.jup.ag/v6` | `https://api.jup.ag/swap/v1/` |
| `/v6/quote`                   | `/swap/v1/quote`              |
| `/v6/swap`                    | `/swap/v1/swap`               |
| Sem header obrigatório        | `x-api-key` OBRIGATÓRIO       |

## Arquivos Criados

### 1. `src/services/jupiter.ts`

Serviço cliente-side para integração com Jupiter API.

**Características:**

- ✅ Connection Solana usando Helius RPC (evita drops)
- ✅ Fallback para RPC público com aviso
- ✅ Jupiter API V1 (não V6)
- ✅ Header `x-api-key` obrigatório
- ✅ Otimização mobile (dynamicComputeUnitLimit, prioritizationFeeLamports)
- ✅ TypeScript estrito (sem `any`)

**Funções principais:**

- `getQuote()` - Obter cotação de swap
- `buildSwapTransaction()` - Construir transação (mobile-optimized)
- `sendTransaction()` - Enviar via Helius RPC
- `confirmTransaction()` - Confirmar transação

### 2. `src/hooks/useJupiterSwap.ts`

Hook React para operações de swap com integração Bags Shield.

**Características:**

- ✅ **Fail-closed security**: Bloqueia swap se `isSafe=false`
- ✅ Estados claros: `isLoadingQuote`, `isSwapping`, `error`
- ✅ Mensagens de erro amigáveis ao usuário
- ✅ TypeScript estrito

**API do Hook:**

```typescript
const {
  // Quote state
  quote,
  isLoadingQuote,
  quoteError,

  // Swap state
  isSwapping,
  swapError,
  swapSignature,

  // Actions
  fetchQuote,
  executeSwap,
  reset,
} = useJupiterSwap({
  isSafe: true, // REQUIRED: Bags Shield security flag
  onSuccess: (signature) => console.log('Swap success:', signature),
  onError: (error) => console.error('Swap error:', error),
});
```

## Segurança: Fail-Closed Design

**CRÍTICO:** O hook implementa fail-closed security:

```typescript
// Se isSafe for false ou undefined, swap é BLOQUEADO
// ANTES mesmo de pedir assinatura à carteira
if (isSafe === false || isSafe === undefined) {
  throw new Error('Swap Blocked: Token marked as High Risk by Bags Shield.');
}
```

Isso garante que tokens marcados como alto risco pelo Bags Shield **nunca** sejam trocados, mesmo que o usuário tente forçar.

## Otimização Mobile

O serviço força otimizações mobile obrigatórias:

```typescript
const swapParams = {
  ...params,
  dynamicComputeUnitLimit: true, // REQUIRED for mobile
  prioritizationFeeLamports: 'auto', // REQUIRED for mobile
};
```

Isso garante:

- ✅ Estimativa dinâmica de compute units (evita falhas)
- ✅ Priorização automática de fees (melhor UX)

## Configuração

### Variáveis de Ambiente Necessárias

Adicione ao `.env.local`:

```bash
# Jupiter API
NEXT_PUBLIC_JUPITER_API_BASE=https://api.jup.ag
NEXT_PUBLIC_JUPITER_API_KEY=sua_chave_aqui

# Helius RPC (recomendado para evitar drops)
NEXT_PUBLIC_HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=sua_chave_helius
```

### Dependências

Instale as dependências necessárias:

```bash
pnpm add @solana/web3.js
```

## Exemplo de Uso

```typescript
import { useJupiterSwap } from '@/hooks/useJupiterSwap';
import { useWallet } from '@solana/wallet-adapter-react';

function SwapComponent() {
  const { publicKey, signTransaction } = useWallet();
  const { isSafe } = useBagsShieldScan(); // Seu hook de segurança

  const {
    quote,
    isLoadingQuote,
    quoteError,
    isSwapping,
    swapError,
    fetchQuote,
    executeSwap,
  } = useJupiterSwap({
    isSafe, // Bags Shield security flag
    onSuccess: (signature) => {
      console.log('Swap realizado:', signature);
    },
    onError: (error) => {
      console.error('Erro no swap:', error);
    },
  });

  // Obter cotação
  const handleGetQuote = async () => {
    await fetchQuote({
      inputMint: 'So11111111111111111111111111111111111111112', // SOL
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      amount: '100000000', // 0.1 SOL
      slippageBps: 50, // 0.5%
    });
  };

  // Executar swap
  const handleSwap = async () => {
    if (!quote || !publicKey) return;

    await executeSwap(
      quote,
      publicKey.toBase58(),
      async (transactionBase64: string) => {
        // Assinar transação com carteira
        const transaction = VersionedTransaction.deserialize(
          Buffer.from(transactionBase64, 'base64')
        );
        const signed = await signTransaction(transaction);
        return Buffer.from(signed.serialize()).toString('base64');
      }
    );
  };

  return (
    <div>
      <button onClick={handleGetQuote} disabled={isLoadingQuote}>
        {isLoadingQuote ? 'Obtendo cotação...' : 'Obter Cotação'}
      </button>

      {quoteError && <p>Erro: {quoteError}</p>}

      {quote && (
        <div>
          <p>Out Amount: {quote.outAmount}</p>
          <button onClick={handleSwap} disabled={isSwapping}>
            {isSwapping ? 'Processando...' : 'Executar Swap'}
          </button>
        </div>
      )}

      {swapError && <p>Erro: {swapError}</p>}
    </div>
  );
}
```

## Mensagens de Erro Amigáveis

O hook traduz erros técnicos em mensagens amigáveis:

| Erro Técnico           | Mensagem ao Usuário                                |
| ---------------------- | -------------------------------------------------- |
| `slippage`             | "Slippage muito baixo. Aumente a tolerância..."    |
| `insufficient balance` | "Saldo insuficiente. Verifique seu saldo..."       |
| `network error`        | "Erro de rede. Verifique sua conexão..."           |
| `Swap Blocked`         | "Swap bloqueado: Token marcado como Alto Risco..." |

## Performance & Confiabilidade

1. **Helius RPC**: Usa Helius RPC quando disponível (evita drops de transação)
2. **Retry Logic**: `maxRetries: 3` no envio de transação
3. **Confirmation**: Aguarda confirmação antes de considerar sucesso

## Próximos Passos

1. ✅ Instalar `@solana/web3.js`: `pnpm add @solana/web3.js`
2. ✅ Configurar variáveis de ambiente no `.env.local`
3. ✅ Integrar hook em componentes de swap
4. ✅ Conectar com Bags Shield para obter `isSafe`

## Notas Técnicas

- **TypeScript**: Tipagem estrita, sem `any`
- **Error Handling**: Tratamento robusto com mensagens amigáveis
- **Mobile-First**: Otimizações obrigatórias para mobile
- **Security-First**: Fail-closed design com Bags Shield
