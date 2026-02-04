# Redis Rate Limiting - Produção Distribuída

## Visão Geral

Para produção com múltiplas instâncias (Vercel Edge Functions, múltiplos servidores), o rate limiting in-memory não funciona. É necessário usar Redis distribuído.

## Opções Recomendadas

### 1. Upstash Redis (Recomendado)

**Vantagens:**

- ✅ Compatível com Vercel Edge Functions
- ✅ Serverless (sem gerenciamento)
- ✅ Baixa latência
- ✅ Free tier generoso

**Instalação:**

```bash
pnpm add @upstash/redis @upstash/ratelimit
```

**Configuração:**

1. Crie conta em: https://upstash.com/
2. Crie um Redis database
3. Adicione variáveis de ambiente:

```bash
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

**Implementação:**

```typescript
// lib/security/rate-limit-redis.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.tokenBucket(10, 2, 60), // 10 tokens, 2/sec, 60s window
  analytics: true,
  prefix: '@bags-shield-api/rate-limit',
});
```

**Uso no middleware:**

```typescript
// middleware.ts
import { rateLimiter } from '@/lib/security/rate-limit-redis';

const { success, limit, remaining, reset } = await rateLimiter.limit(identifier);
```

### 2. Vercel KV

**Vantagens:**

- ✅ Integrado com Vercel
- ✅ Fácil configuração
- ✅ Edge-compatible

**Instalação:**

```bash
pnpm add @vercel/kv
```

**Configuração:**

1. No Vercel Dashboard: Settings → Storage → Create KV Database
2. Variáveis são configuradas automaticamente

**Implementação:**

```typescript
// lib/security/rate-limit-kv.ts
import { kv } from '@vercel/kv';

export async function checkRateLimitKV(identifier: string) {
  // Implementação Token Bucket com KV
  // (ver lib/security/rate-limit-redis.ts para exemplo completo)
}
```

### 3. Redis Próprio (Não Recomendado)

**Desvantagens:**

- ❌ Requer servidor dedicado
- ❌ Não funciona bem com serverless
- ❌ Mais complexo de gerenciar

**Quando usar:**

- Apenas se você já tem infraestrutura Redis
- Aplicações não-serverless

## Migração do In-Memory para Redis

### Passo 1: Instalar Dependências

```bash
pnpm add @upstash/redis @upstash/ratelimit
```

### Passo 2: Criar Arquivo de Rate Limiting

Crie `lib/security/rate-limit-redis.ts` (exemplo em `lib/security/rate-limit-redis.ts`)

### Passo 3: Atualizar Middleware

Substitua a implementação in-memory por Redis:

```typescript
// middleware.ts
import { rateLimiter } from '@/lib/security/rate-limit-redis';

// Substituir:
// const limit = rateLimit(identifier, 10, 2, 60_000);

// Por:
const { success, limit, remaining, reset } = await rateLimiter.limit(identifier);
```

### Passo 4: Configurar Variáveis de Ambiente

No Vercel:

1. Settings → Environment Variables
2. Adicionar `UPSTASH_REDIS_REST_URL`
3. Adicionar `UPSTASH_REDIS_REST_TOKEN`

## Comparação

| Solução       | Latência    | Custo     | Edge Compatible | Complexidade |
| ------------- | ----------- | --------- | --------------- | ------------ |
| In-Memory     | Muito Baixa | Grátis    | ❌ Não          | Baixa        |
| Upstash Redis | Baixa       | Free tier | ✅ Sim          | Baixa        |
| Vercel KV     | Baixa       | Free tier | ✅ Sim          | Baixa        |
| Redis Próprio | Muito Baixa | $$$       | ❌ Não          | Alta         |

## Recomendação

**Para produção no Vercel:** Use **Upstash Redis** ou **Vercel KV**.

Ambos são:

- ✅ Serverless
- ✅ Edge-compatible
- ✅ Free tier generoso
- ✅ Fácil configuração

## Testes

Após migrar para Redis, execute:

```bash
pnpm test:security
```

Isso testará se o rate limiting distribuído está funcionando corretamente.

## Monitoramento

### Upstash Dashboard

- Acesse: https://console.upstash.com/
- Veja métricas de rate limiting
- Monitore uso de Redis

### Vercel Analytics

- Rate limit violations aparecem em logs
- Configure alertas para 429 responses

## Troubleshooting

### Problema: Rate limit não funciona após migração

**Causa:** Variáveis de ambiente não configuradas  
**Solução:** Verifique `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`

### Problema: Latência alta

**Causa:** Redis em região distante  
**Solução:** Escolha região mais próxima no Upstash

### Problema: Rate limit muito restritivo

**Causa:** Configuração incorreta  
**Solução:** Ajuste `capacity` e `refillRate` no Ratelimit

## Próximos Passos

1. ✅ Escolher solução (Upstash ou Vercel KV)
2. ✅ Instalar dependências
3. ✅ Configurar variáveis de ambiente
4. ✅ Migrar middleware
5. ✅ Testar com `pnpm test:security`
6. ✅ Monitorar em produção
