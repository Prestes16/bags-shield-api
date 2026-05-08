import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders, applyNoStore, applySecurityHeaders } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RPC_URL = (process.env.SOLANA_RPC_URL || '').trim();

export async function OPTIONS(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  applyCorsHeaders(req, res);
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,solana-client,x-solana-client');
  applyNoStore(res);
  applySecurityHeaders(res);
  return res;
}

export async function POST(req: NextRequest) {
  if (!RPC_URL) {
    const res = NextResponse.json(
      { success: false, error: 'SOLANA_RPC_URL not configured' },
      { status: 500 }
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    applySecurityHeaders(res);
    return res;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const res = NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    applySecurityHeaders(res);
    return res;
  }

  try {
    const upstream = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const text = await upstream.text();
    const res = new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });

    applyCorsHeaders(req, res);
    applyNoStore(res);
    applySecurityHeaders(res);
    return res;
  } catch (err) {
    const res = NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'RPC proxy failed' },
      { status: 502 }
    );
    applyCorsHeaders(req, res);
    applyNoStore(res);
    applySecurityHeaders(res);
    return res;
  }
}
