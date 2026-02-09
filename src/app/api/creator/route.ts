/**
 * Token Creator — scaffold. Returns 501 when FEATURE_TOKEN_CREATOR is not enabled.
 */

import { NextResponse } from 'next/server';
import { isTokenCreatorEnabled } from '@/lib/creator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isTokenCreatorEnabled()) {
    return NextResponse.json(
      {
        success: false,
        error: 'Token Creator is not enabled.',
        code: 'NOT_IMPLEMENTED',
      },
      { status: 501, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return NextResponse.json({ success: false, error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, { status: 501 });
}

export async function POST() {
  if (!isTokenCreatorEnabled()) {
    return NextResponse.json(
      {
        success: false,
        error: 'Token Creator is not enabled.',
        code: 'NOT_IMPLEMENTED',
      },
      { status: 501, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return NextResponse.json({ success: false, error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, { status: 501 });
}
