# ✅ Atualizações - Jupiter API (Ajustes Finais)

## 📋 Mudanças Implementadas

### 1. ⚠️ Aviso de Deprecation Adicionado

**`lite-api.jup.ag` será descontinuado em 31 de janeiro de 2026**

- ✅ Adicionado aviso em todas as documentações relevantes
- ✅ Confirmado que estamos usando `api.jup.ag` (versão atual)
- ✅ Nenhuma ação necessária - já estamos atualizados

### 2. 🔐 Header x-api-key Tornado Obrigatório

**O header `x-api-key` é OBRIGATÓRIO em todos os endpoints**

**Mudanças no código (`lib/jupiter.ts`):**

- ✅ Validação obrigatória: lança erro se `JUPITER_API_KEY` não estiver configurada
- ✅ Sempre envia `x-api-key` em todas as requisições
- ✅ Erro claro quando a chave está faltando

**Antes:**

```typescript
if (this.apiKey) {
  headers['x-api-key'] = this.apiKey;
}
```

**Depois:**

```typescript
// x-api-key é OBRIGATÓRIO em todos os endpoints
if (!this.apiKey) {
  throw new Error('JUPITER_API_KEY não está configurada...');
}
headers['x-api-key'] = this.apiKey;
```

### 3. 📝 Parâmetros Opcionais Úteis Adicionados ao /quote

**Novos parâmetros disponíveis:**

| Parâmetro            | Tipo                      | Descrição                                       |
| -------------------- | ------------------------- | ----------------------------------------------- |
| `swapMode`           | `'ExactIn' \| 'ExactOut'` | Modo de swap (padrão: ExactIn)                  |
| `dexes`              | `string[]`                | Lista de DEXes para incluir                     |
| `excludeDexes`       | `string[]`                | Lista de DEXes para excluir                     |
| `instructionVersion` | `number`                  | Versão da instrução (0 = legacy, 1 = versioned) |

**Exemplos de uso:**

```typescript
// ExactOut: quantidade exata de saída
await jupiterClient.getQuote({
  inputMint: 'SOL',
  outputMint: 'USDC',
  amount: '100000000',
  swapMode: 'ExactOut',
});

// Excluindo DEXes específicas
await jupiterClient.getQuote({
  inputMint: 'SOL',
  outputMint: 'USDC',
  amount: '100000000',
  excludeDexes: ['Raydium', 'Orca'],
});
```

### 4. 🚫 Correção: dynamicSlippage

**`dynamicSlippage` NÃO é aplicável no `/quote`**

- ✅ Documentação atualizada para deixar claro
- ✅ `dynamicSlippage` só funciona no `/swap` (já estava correto no código)
- ✅ Nota adicionada na documentação

## 📄 Arquivos Atualizados

### Código

- ✅ `lib/jupiter.ts` - Validação obrigatória de x-api-key e novos parâmetros

### Documentação

- ✅ `JUPITER_SWAP.md` - Avisos de deprecation, x-api-key obrigatório, novos parâmetros
- ✅ `VERIFICACAO_JUPITER_API.md` - Seção sobre deprecation e x-api-key
- ✅ `CONFIGURACAO_JUPITER.md` - Avisos importantes no início
- ✅ `ATUALIZACOES_JUPITER_API.md` - Este arquivo (resumo das mudanças)

## 🎯 Endpoints Corretos (Confirmados)

| Endpoint          | Método | URL Completa                                   |
| ----------------- | ------ | ---------------------------------------------- |
| Quote             | GET    | `https://api.jup.ag/swap/v1/quote`             |
| Swap              | POST   | `https://api.jup.ag/swap/v1/swap`              |
| Swap Instructions | POST   | `https://api.jup.ag/swap/v1/swap-instructions` |
| Price             | GET    | `https://api.jup.ag/price/v3?ids=...`          |

## ✅ Status Final

- ✅ Base URL correta (`api.jup.ag`)
- ✅ Versões corretas (v1 para swap, v3 para price)
- ✅ Header x-api-key obrigatório e validado
- ✅ Parâmetros úteis adicionados ao /quote
- ✅ Documentação atualizada com avisos importantes
- ✅ Nenhuma referência a APIs deprecated

**A integração está completa, atualizada e pronta para uso!**
