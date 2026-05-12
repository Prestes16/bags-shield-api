/**
 * Next.js Edge Middleware — CORS global para todas as rotas /api/*
 *
 * Garante que qualquer rota da API responda corretamente a:
 *   1. Preflight OPTIONS (evita CORS block no browser)
 *   2. Requisições normais (adiciona Access-Control-Allow-Origin)
 */

import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'https://app.bagsshield.org',
  'https://bags-shield-app2.vercel.app',
  'https://bags-shield-api.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
  'Access-Control-Allow-Headers':
    'Content-Type,Authorization,X-Api-Key,X-Request-Id,Idempotency-Key,x-api-key',
  'Access-Control-Expose-Headers': 'X-Request-Id,X-RateLimit-Remaining',
  'Access-Control-Max-Age': '86400',
};

function getAllowedOrigin(origin: string | null): string {
  // Lê lista extra de CORS_ORIGINS env var (vírgula-separado)
  const envOrigins = (process.env.CORS_ORIGINS ?? '').trim();
  const extraOrigins = envOrigins
    ? envOrigins.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const allAllowed = [...ALLOWED_ORIGINS, ...extraOrigins];

  if (!origin) return allAllowed[0];
  if (allAllowed.includes(origin)) return origin;

  // Em dev/preview permite qualquer origin Vercel
  if (
    process.env.VERCEL_ENV !== 'production' &&
    origin.endsWith('.vercel.app')
  ) {
    return origin;
  }

  return allAllowed[0];
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigin = getAllowedOrigin(origin);

  // Preflight OPTIONS — responde imediatamente sem chegar na rota
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        ...CORS_HEADERS,
        'Cache-Control': 'no-store',
      },
    });
  }

  // Para outras requisições, deixa passar mas injeta o header CORS
  const response = NextResponse.next();
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => {
    if (k !== 'Access-Control-Max-Age') response.headers.set(k, v);
  });
  return response;
}

export const config = {
  // Aplica apenas em rotas de API
  matcher: ['/api/:path*'],
};
