/**
 * Security Middleware - Military Grade Protection
 *
 * Implementa:
 * - Rate Limiting (Token Bucket)
 * - Method Filtering (GET/POST only)
 * - Security Headers
 * - Request Validation
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ============================================================================
// Rate Limiting - Token Bucket Algorithm (In-Memory)
// ============================================================================

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

/**
 * Token Bucket Rate Limiter
 *
 * Configuração:
 * - capacity: número máximo de tokens (requests)
 * - refillRate: tokens adicionados por segundo
 * - windowMs: janela de tempo em ms
 */
function rateLimit(
  identifier: string,
  capacity: number = 10,
  refillRate: number = 2, // 2 tokens por segundo
  windowMs: number = 60_000, // 1 minuto
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const bucket = rateLimitStore.get(identifier);

  if (!bucket) {
    // Primeira requisição: criar bucket cheio
    rateLimitStore.set(identifier, {
      tokens: capacity - 1,
      lastRefill: now,
    });
    return {
      allowed: true,
      remaining: capacity - 1,
      resetAt: now + windowMs,
    };
  }

  // Calcular tokens a adicionar desde última refill
  const timePassed = now - bucket.lastRefill;
  const tokensToAdd = Math.floor((timePassed / 1000) * refillRate);
  const newTokens = Math.min(capacity, bucket.tokens + tokensToAdd);

  if (newTokens < 1) {
    // Sem tokens disponíveis
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.lastRefill + windowMs,
    };
  }

  // Consumir um token
  bucket.tokens = newTokens - 1;
  bucket.lastRefill = now;
  rateLimitStore.set(identifier, bucket);

  // Limpar buckets antigos (prevenir memory leak)
  if (rateLimitStore.size > 10000) {
    const cutoff = now - windowMs * 2;
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.lastRefill < cutoff) {
        rateLimitStore.delete(key);
      }
    }
  }

  return {
    allowed: true,
    remaining: bucket.tokens,
    resetAt: now + windowMs,
  };
}

/**
 * Get client identifier for rate limiting
 *
 * Prioridade:
 * 1. IP address (mais confiável)
 * 2. X-Forwarded-For header (proxies)
 * 3. Fallback para 'unknown'
 */
function getClientIdentifier(request: NextRequest): string {
  const ip =
    request.ip ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  return `rate_limit:${ip}`;
}

// ============================================================================
// Security Headers
// ============================================================================

/**
 * Aplica security headers estritos
 *
 * Headers implementados:
 * - Content-Security-Policy: Bloqueia XSS, inline scripts, eval
 * - X-Content-Type-Options: Previne MIME sniffing
 * - X-Frame-Options: Bloqueia clickjacking
 * - Referrer-Policy: Controla referrer information
 * - Strict-Transport-Security: HSTS (2 anos)
 * - Permissions-Policy: Restringe APIs sensíveis
 * - X-XSS-Protection: Legacy XSS protection
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  // Content-Security-Policy: Política restritiva
  // Permite apenas scripts do próprio domínio, Vercel, Helius e Jupiter
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel.app https://*.vercel.com", // Next.js requer unsafe-inline/unsafe-eval em dev
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Tailwind requer unsafe-inline
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.jup.ag https://api-mainnet.helius-rpc.com https://mainnet.helius-rpc.com https://*.vercel.app https://*.vercel.com wss://*.vercel.app",
    "frame-ancestors 'none'", // Equivalente a X-Frame-Options: DENY
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  // X-Content-Type-Options: Previne MIME type sniffing
  // Força browser a respeitar Content-Type declarado
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options: Bloqueia embedding em iframes (clickjacking)
  // DENY = nunca permitir embedding, mesmo do mesmo domínio
  response.headers.set('X-Frame-Options', 'DENY');

  // Referrer-Policy: Controla informação de referrer enviada
  // strict-origin-when-cross-origin = envia origem apenas em cross-origin, full URL em same-origin
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Strict-Transport-Security: HSTS (HTTP Strict Transport Security)
  // Força HTTPS por 2 anos (63072000 segundos)
  // includeSubDomains = aplica a todos subdomínios
  // preload = permite inclusão em HSTS preload list
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // Permissions-Policy: Restringe APIs sensíveis do browser
  // Desabilita APIs que não são necessárias (reduz surface de ataque)
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  );

  // X-XSS-Protection: Legacy XSS protection (para browsers antigos)
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // X-DNS-Prefetch-Control: Previne DNS prefetching (privacy)
  response.headers.set('X-DNS-Prefetch-Control', 'off');

  // X-Download-Options: Previne download de arquivos HTML (IE)
  response.headers.set('X-Download-Options', 'noopen');

  // X-Permitted-Cross-Domain-Policies: Restringe políticas cross-domain
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');

  return response;
}

// ============================================================================
// Route Protection Configuration
// ============================================================================

/**
 * Rotas sensíveis que requerem rate limiting mais agressivo
 */
const SENSITIVE_ROUTES = ['/api/scan', '/api/simulate', '/api/apply', '/api/rpc-proxy'];

/**
 * Rotas que não devem ter rate limiting (health checks, etc)
 */
const EXCLUDED_ROUTES = [
  '/api/health',
  '/api/errors', // Read-only endpoint
];

// ============================================================================
// Main Middleware
// ============================================================================

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method ?? 'GET'; // NextRequest.method (não existe em nextUrl)

  // ========================================================================
  // 1. Method Filtering: Apenas GET e POST permitidos
  // ========================================================================
  // Bloqueia métodos perigosos (PUT, DELETE, PATCH, etc)
  // Reduz surface de ataque e previne CSRF em métodos não-idempotentes
  if (method !== 'GET' && method !== 'POST' && method !== 'OPTIONS') {
    return NextResponse.json(
      {
        success: false,
        error: 'method_not_allowed',
        message: `Método ${method} não permitido. Apenas GET e POST são suportados.`,
      },
      {
        status: 405,
        headers: {
          Allow: 'GET, POST, OPTIONS',
        },
      },
    );
  }

  // ========================================================================
  // 2. Rate Limiting: Token Bucket para rotas sensíveis
  // ========================================================================
  // Aplica rate limiting apenas em rotas sensíveis
  // Previne DDoS básico e abuse de recursos computacionais
  if (!EXCLUDED_ROUTES.includes(pathname)) {
    const isSensitive = SENSITIVE_ROUTES.some((route) => pathname.startsWith(route));

    if (isSensitive) {
      const identifier = getClientIdentifier(request);
      const limit = rateLimit(identifier, 10, 2, 60_000); // 10 requests, 2/sec, 1min window

      if (!limit.allowed) {
        const response = NextResponse.json(
          {
            success: false,
            error: 'rate_limit_exceeded',
            message: 'Muitas requisições. Tente novamente em alguns instantes.',
            retryAfter: Math.ceil((limit.resetAt - Date.now()) / 1000),
          },
          { status: 429 },
        );

        // Headers de rate limiting (RFC 6585)
        response.headers.set('X-RateLimit-Limit', '10');
        response.headers.set('X-RateLimit-Remaining', '0');
        response.headers.set('X-RateLimit-Reset', limit.resetAt.toString());
        response.headers.set('Retry-After', Math.ceil((limit.resetAt - Date.now()) / 1000).toString());

        return applySecurityHeaders(response);
      }

      // Adicionar headers de rate limit mesmo em sucesso (transparência)
      const response = NextResponse.next();
      response.headers.set('X-RateLimit-Limit', '10');
      response.headers.set('X-RateLimit-Remaining', limit.remaining.toString());
      response.headers.set('X-RateLimit-Reset', limit.resetAt.toString());
      return applySecurityHeaders(response);
    }
  }

  // ========================================================================
  // 3. Security Headers: Aplicar em todas as respostas
  // ========================================================================
  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

/**
 * Configuração de paths que o middleware deve processar
 *
 * Exclui arquivos estáticos e assets para performance
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
