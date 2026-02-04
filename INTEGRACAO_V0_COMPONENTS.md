# Integração com Componentes v0 - Jupiter Swap

## Visão Geral

Este guia explica como integrar o hook `useJupiterSwap` com componentes gerados pelo v0 que usam `wallet.sendTransaction()`.

## Mudanças Implementadas

### 1. Hook Atualizado para v0 Compatibility

O hook `useJupiterSwap` agora retorna `VersionedTransaction` deserializada, compatível com componentes v0.

**Antes (incompatível com v0):**

```typescript
signTransaction: (transaction: string) => Promise<string>;
// Recebia base64 string, retornava base64 string
```

**Depois (compatível com v0):**

```typescript
signTransaction: (transaction: VersionedTransaction) => Promise<VersionedTransaction>;
// Recebe VersionedTransaction, retorna VersionedTransaction assinada
```

### 2. Novo Método: `buildSwapTransactionOnly`

Cria apenas a transação sem enviar, útil para componentes v0 que gerenciam o envio:

```typescript
const transaction = await buildSwapTransactionOnly(quote, userPublicKey);
// Retorna VersionedTransaction pronta para wallet.sendTransaction()
```

## Uso com Componentes v0

### Opção 1: Usar `executeSwap` (Recomendado)

O hook gerencia todo o fluxo (construir → assinar → enviar → confirmar):

```typescript
import { useJupiterSwap } from '@/hooks/useJupiterSwap';
import { useWallet } from '@solana/wallet-adapter-react';

function SwapComponent() {
  const { publicKey, signTransaction } = useWallet();
  const { quote, executeSwap, isSwapping } = useJupiterSwap({
    isSafe: true, // Bags Shield security
  });

  const handleSwap = async () => {
    if (!quote || !publicKey) return;

    await executeSwap(
      quote,
      publicKey.toBase58(),
      // signTransaction recebe VersionedTransaction diretamente
      // Compatível com wallet.sendTransaction() do v0
      async (transaction) => {
        return await signTransaction(transaction);
      }
    );
  };

  return (
    <button onClick={handleSwap} disabled={isSwapping}>
      Executar Swap
    </button>
  );
}
```

### Opção 2: Usar `buildSwapTransactionOnly` + `wallet.sendTransaction`

Para componentes v0 que precisam controlar o envio:

```typescript
import { useJupiterSwap } from '@/hooks/useJupiterSwap';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';

function SwapComponent() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { quote, buildSwapTransactionOnly, isSwapping } = useJupiterSwap({
    isSafe: true,
  });

  const handleSwap = async () => {
    if (!quote || !publicKey) return;

    try {
      // 1. Construir transação (retorna VersionedTransaction)
      const transaction = await buildSwapTransactionOnly(
        quote,
        publicKey.toBase58()
      );

      // 2. Enviar com wallet.sendTransaction (v0 usa isso)
      const signature = await sendTransaction(transaction, connection);

      // 3. Aguardar confirmação (opcional)
      await connection.confirmTransaction(signature, 'confirmed');

      console.log('Swap realizado:', signature);
    } catch (error) {
      console.error('Erro no swap:', error);
    }
  };

  return (
    <button onClick={handleSwap} disabled={isSwapping}>
      Executar Swap
    </button>
  );
}
```

## Mapeamento de Imagem de Token (Helius)

Para componentes que exibem informações de token, mapeie a imagem assim:

```typescript
// No componente pai (page.tsx ou componente que chama TokenDashboard)
const tokenImage =
  apiData.content?.links?.image ||     // Padrão DAS (Helius v2)
  apiData.token_info?.image ||         // Padrão Token Metadata
  apiData.image ||                     // Fallback simples
  "";                                  // Vazio para ativar ícone genérico

// Passar para componente v0
<TokenDashboard
  scanData={apiData}
  tokenImage={tokenImage}  // Passando explicitamente
  lang={currentLanguage}   // 'pt' ou 'en'
/>
```

## Estados Disponíveis no Hook

```typescript
const {
  // Quote
  quote, // JupiterQuoteResponse | null
  isLoadingQuote, // boolean
  quoteError, // string | null

  // Swap
  isSwapping, // boolean
  swapError, // string | null
  swapSignature, // string | null (signature da transação)
  swapTransaction, // VersionedTransaction | null (transação deserializada)

  // Actions
  fetchQuote, // Obter cotação
  executeSwap, // Executar swap completo
  buildSwapTransactionOnly, // Apenas construir transação
  reset, // Resetar estado
} = useJupiterSwap({ isSafe: true });
```

## Exemplo Completo com v0

```typescript
'use client';

import { useJupiterSwap } from '@/hooks/useJupiterSwap';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';

export function JupiterSwapButton() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { isSafe } = useBagsShieldScan(); // Seu hook de segurança

  const {
    quote,
    isLoadingQuote,
    swapTransaction,
    buildSwapTransactionOnly,
    executeSwap,
    isSwapping,
    swapError,
    fetchQuote,
  } = useJupiterSwap({
    isSafe,
    onSuccess: (signature) => {
      console.log('✅ Swap realizado:', signature);
      // Mostrar toast de sucesso
    },
    onError: (error) => {
      console.error('❌ Erro:', error);
      // Mostrar toast de erro
    },
  });

  // Obter cotação
  const handleGetQuote = async () => {
    await fetchQuote({
      inputMint: 'So11111111111111111111111111111111111111112', // SOL
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      amount: '100000000', // 0.1 SOL
      slippageBps: 50,
    });
  };

  // Opção 1: Swap completo (hook gerencia tudo)
  const handleSwapComplete = async () => {
    if (!quote || !publicKey) return;

    await executeSwap(
      quote,
      publicKey.toBase58(),
      async (transaction) => {
        // v0 espera VersionedTransaction diretamente
        return await sendTransaction(transaction, connection);
      }
    );
  };

  // Opção 2: Apenas construir transação (v0 gerencia envio)
  const handleBuildOnly = async () => {
    if (!quote || !publicKey) return;

    const transaction = await buildSwapTransactionOnly(
      quote,
      publicKey.toBase58()
    );

    // v0 pode usar diretamente:
    // await sendTransaction(transaction, connection);
  };

  return (
    <div>
      <button onClick={handleGetQuote} disabled={isLoadingQuote}>
        Obter Cotação
      </button>

      {quote && (
        <div>
          <p>Output: {quote.outAmount}</p>
          <button onClick={handleSwapComplete} disabled={isSwapping}>
            Executar Swap
          </button>
          <button onClick={handleBuildOnly} disabled={isSwapping}>
            Construir Transação
          </button>
        </div>
      )}

      {swapError && <p>Erro: {swapError}</p>}
      {swapTransaction && <p>✅ Transação pronta para assinar</p>}
    </div>
  );
}
```

## Diferenças Importantes

### Antes (Incompatível com v0)

```typescript
// Hook retornava string base64
const signedBase64 = await signTransaction(base64String);
// Precisava deserializar manualmente
const transaction = VersionedTransaction.deserialize(Buffer.from(signedBase64, 'base64'));
```

### Depois (Compatível com v0)

```typescript
// Hook retorna VersionedTransaction diretamente
const signedTransaction = await signTransaction(transaction);
// Pode usar diretamente com wallet.sendTransaction()
await sendTransaction(signedTransaction, connection);
```

## Segurança Mantida

- ✅ Fail-closed security ainda funciona (`isSafe` check)
- ✅ Validação de transação mantida
- ✅ Sanitização de inputs preservada
- ✅ Error handling robusto

## Próximos Passos

1. ✅ Hook atualizado para retornar `VersionedTransaction`
2. ✅ Novo método `buildSwapTransactionOnly` adicionado
3. ✅ Exemplo atualizado com uso v0
4. ⏭️ Integrar em componentes v0 específicos
5. ⏭️ Testar com wallet adapters reais

## Notas Técnicas

- `VersionedTransaction` é o tipo correto para transações Solana modernas
- `wallet.sendTransaction()` espera `VersionedTransaction` diretamente
- Componentes v0 usam `sendTransaction` internamente, então precisam da transação deserializada
- O hook ainda suporta o fluxo completo (construir → assinar → enviar → confirmar)
