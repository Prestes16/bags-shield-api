/**
 * GET /api/rpc/health - RPC health check para smoke tests
 */

import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders, handlePreflight } from '@/lib/security/cors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const res = NextResponse.json(
    {
      success: true,
      rpc: 'ok',
      ts: new Date().toISOString(),
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  );

  return applyCorsHeaders(req, res) as NextResponse;
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ['GET', 'OPTIONS']);
}
