/**
 * GET /api/status - Status endpoint para smoke checks
 */

import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders, handlePreflight } from '@/lib/security/cors';
import { publicScanPaywallStatus } from '@/lib/scan/paywall';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const res = NextResponse.json(
    {
      success: true,
      response: {
        ok: true,
        ts: new Date().toISOString(),
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
        ...publicScanPaywallStatus(),
      },
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
