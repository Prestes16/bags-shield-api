/**
 * Rate Limiting com Redis (Produção)
 *
 * ⚠️ Este é um exemplo de implementação para produção distribuída.
 *
 * Para usar:
 * 1. Instalar: pnpm add @upstash/redis @upstash/ratelimit
 * 2. Configurar UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN
 * 3. Substituir implementação in-memory por esta
 */

/**
 * Exemplo usando Upstash Redis (compatível com Vercel Edge)
 *
 * Instalação:
 * pnpm add @upstash/redis @upstash/ratelimit
 */

/*
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Configuração Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate Limiter com Token Bucket
export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.tokenBucket(
    10, // capacity: 10 tokens
    2,  // refillRate: 2 tokens por segundo
    60  // interval: 60 segundos
  ),
  analytics: true,
  prefix: '@bags-shield-api/rate-limit',
});

// Uso no middleware:
export async function checkRateLimit(identifier: string) {
  const { success, limit, remaining, reset } = await rateLimiter.limit(identifier);
  
  return {
    allowed: success,
    limit,
    remaining,
    reset: reset.getTime(),
  };
}
*/

/**
 * Exemplo usando Vercel KV (alternativa)
 *
 * Instalação:
 * pnpm add @vercel/kv
 */

/*
import { kv } from '@vercel/kv';

export async function checkRateLimitKV(identifier: string) {
  const key = `rate_limit:${identifier}`;
  const now = Date.now();
  const windowMs = 60_000; // 1 minuto
  const capacity = 10;
  const refillRate = 2; // tokens por segundo
  
  // Obter estado atual
  const current = await kv.get<{ tokens: number; lastRefill: number }>(key);
  
  if (!current) {
    // Primeira requisição
    await kv.set(key, { tokens: capacity - 1, lastRefill: now }, { ex: 60 });
    return {
      allowed: true,
      remaining: capacity - 1,
      resetAt: now + windowMs,
    };
  }
  
  // Calcular tokens a adicionar
  const timePassed = now - current.lastRefill;
  const tokensToAdd = Math.floor((timePassed / 1000) * refillRate);
  const newTokens = Math.min(capacity, current.tokens + tokensToAdd);
  
  if (newTokens < 1) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.lastRefill + windowMs,
    };
  }
  
  // Consumir token
  const updated = {
    tokens: newTokens - 1,
    lastRefill: now,
  };
  
  await kv.set(key, updated, { ex: 60 });
  
  return {
    allowed: true,
    remaining: updated.tokens,
    resetAt: now + windowMs,
  };
}
*/

/**
 * Configuração recomendada para produção:
 *
 * 1. Upstash Redis (melhor para Edge Functions):
 *    - UPSTASH_REDIS_REST_URL
 *    - UPSTASH_REDIS_REST_TOKEN
 *
 * 2. Vercel KV (alternativa):
 *    - KV_URL (automático no Vercel)
 *    - KV_REST_API_URL
 *    - KV_REST_API_TOKEN
 *
 * 3. Redis próprio (não recomendado para serverless):
 *    - REDIS_URL
 *    - REDIS_PASSWORD
 */

export {};
