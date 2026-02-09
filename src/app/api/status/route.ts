/**
 * GET /api/status - Status endpoint para smoke checks
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      response: {
        ok: true,
        ts: new Date().toISOString(),
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      },
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
