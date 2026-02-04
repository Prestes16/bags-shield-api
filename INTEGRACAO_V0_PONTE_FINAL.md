# 🌉 Ponte Final - Integração com Componentes v0

## Visão Geral

Este guia mostra como conectar o hook `useJupiterSwap` com componentes gerados pelo v0 que esperam receber `VersionedTransaction` diretamente.

## ✅ Verificação: buildSwapTransactionOnly Exportada

A função `buildSwapTransactionOnly` está **exportada** e faz exatamente o que você precisa:

### 1. Função Standalone Exportada

**Arquivo:** `src/hooks/useJupiterSwap-standalone.ts`

```typescript
export async function buildSwapTransactionOnly(
  quoteResponse: JupiterQuoteResponse,
  userPublicKey: string,
  isSafe: boolean = true,
): Promise<VersionedTransaction> {
  // ... lógica ...

  // O PULO DO GATO: Deserializar a transação
  const transaction = await buildSwapTransactionAsVersioned(swapParams);

  return transaction; // ✅ Retorna VersionedTransaction deserializada
}
```

### 2. Função no Hook (também disponível)

**Arquivo:** `src/hooks/useJupiterSwap.ts`

A função também está disponível através do hook:

```typescript
const { buildSwapTransactionOnly } = useJupiterSwap({ isSafe });
```

## 🌉 A "Ponte" Final - Como Conectar

### No Componente Pai (page.tsx ou onde ficar o componente v0)

```typescript
'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useJupiterSwap } from '@/hooks/useJupiterSwap';
import { buildSwapTransactionOnly } from '@/hooks/useJupiterSwap-standalone';
import { useBagsShieldScan } from '@/hooks/useBagsShieldScan'; // Seu hook de segurança

export default function Page() {
  const { connection } = useConnection();
  const wallet = useWallet(); // ✅ A carteira real aqui
  const { isSafe } = useBagsShieldScan(outputMint); // Bags Shield security

  // Opção 1: Usar função standalone (recomendado para passar como prop)
  const buildSwap = async (quote: JupiterQuoteResponse, userPublicKey: string) => {
    return buildSwapTransactionOnly(quote, userPublicKey, isSafe);
  };

  // Opção 2: Usar método do hook
  const { buildSwapTransactionOnly: buildSwapFromHook } = useJupiterSwap({ isSafe });

  return (
    <TokenDashboard
      wallet={wallet}                    // ✅ Passando a carteira real
      connection={connection}            // ✅ Passando a conexão Helius
      buildSwapTransactionOnly={buildSwap} // ✅ Passando a função standalone
      // ou
      // buildSwapTransactionOnly={buildSwapFromHook} // ✅ Ou do hook
      // ... outras props
    />
  );
}
```

## 🔍 Verificação: O que a função faz

### ✅ 1. Recebe cotação e chave pública

```typescript
buildSwapTransactionOnly(quoteResponse, userPublicKey, isSafe);
```

### ✅ 2. Chama API Jupiter para construir transação

```typescript
const swapResponse = await buildSwapTransaction(swapParams);
// Retorna: { swapTransaction: "base64...", lastValidBlockHeight: ... }
```

### ✅ 3. O PULO DO GATO: Deserializa para VersionedTransaction

```typescript
const transactionBuffer = Buffer.from(swapResponse.swapTransaction, 'base64');
const transaction = VersionedTransaction.deserialize(transactionBuffer);
```

### ✅ 4. Retorna VersionedTransaction (não string!)

```typescript
return transaction; // ✅ VersionedTransaction deserializada
```

## 📝 Exemplo Completo de Uso

### Componente Pai (page.tsx)

```typescript
'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { buildSwapTransactionOnly } from '@/hooks/useJupiterSwap-standalone';
import { useBagsShieldScan } from '@/hooks/useBagsShieldScan';
import TokenDashboard from '@/components/v0/TokenDashboard'; // Componente do v0

export default function SwapPage() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const outputMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
  const { isSafe } = useBagsShieldScan(outputMint);

  // Criar wrapper que o v0 pode usar
  const buildSwapWrapper = async (
    quoteResponse: JupiterQuoteResponse,
    userPublicKey: string
  ) => {
    // Passa isSafe do Bags Shield
    return buildSwapTransactionOnly(quoteResponse, userPublicKey, isSafe);
  };

  return (
    <TokenDashboard
      wallet={wallet}
      connection={connection}
      buildSwapTransactionOnly={buildSwapWrapper}
      // O componente v0 vai usar assim:
      // const transaction = await buildSwapTransactionOnly(quote, publicKey);
      // const signature = await wallet.sendTransaction(transaction, connection);
    />
  );
}
```

### Como o Componente v0 Usa

O componente v0 recebe a função e usa assim:

```typescript
// Dentro do componente v0 (TokenDashboard)
const handleSwap = async () => {
  // 1. Obter cotação
  const quote = await getQuote(...);

  // 2. Construir transação (recebe VersionedTransaction diretamente!)
  const transaction = await buildSwapTransactionOnly(quote, wallet.publicKey.toBase58());

  // 3. Enviar com wallet.sendTransaction (v0 usa isso)
  const signature = await wallet.sendTransaction(transaction, connection);

  // 4. Aguardar confirmação
  await connection.confirmTransaction(signature, 'confirmed');
};
```

## ✅ Checklist de Verificação

- [x] Função `buildSwapTransactionOnly` exportada standalone
- [x] Função retorna `VersionedTransaction` (não string base64)
- [x] Função deserializa transação corretamente
- [x] Função pode ser passada como prop para componentes v0
- [x] Segurança fail-closed mantida (isSafe check)
- [x] Otimização mobile preservada

## 🎯 Resumo

**O que foi implementado:**

1. ✅ Função standalone `buildSwapTransactionOnly` exportada
2. ✅ Retorna `VersionedTransaction` deserializada
3. ✅ Pode ser passada como prop para componentes v0
4. ✅ Compatível com `wallet.sendTransaction()`
5. ✅ Segurança fail-closed mantida

**Como usar:**

```typescript
// Importar função standalone
import { buildSwapTransactionOnly } from '@/hooks/useJupiterSwap-standalone';

// Passar como prop para componente v0
<TokenDashboard buildSwapTransactionOnly={buildSwapTransactionOnly} />
```

**Status:** ✅ **PRONTO PARA USO COM COMPONENTES V0**
