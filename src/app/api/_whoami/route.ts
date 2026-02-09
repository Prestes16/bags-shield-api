/**
 * Prova de qual repo está respondendo.
 * GET /api/_whoami
 */

import { NextRequest, NextResponse } from 'next/server';

const HANDLER = 'bs-api-whoami';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cwd = process.env.NODE_ENV !== 'production' ? process.cwd() : undefined;
  const body: Record<string, unknown> = {
    handlerId: 'bs-api',
    handler: HANDLER,
  };
  if (cwd) body.cwd = cwd;
  if (process.env.VERCEL_GIT_COMMIT_REF) body.gitBranch = process.env.VERCEL_GIT_COMMIT_REF;
  if (process.env.VERCEL_GIT_COMMIT_SHA) body.gitSha = process.env.VERCEL_GIT_COMMIT_SHA;

  const res = NextResponse.json(body, {
    headers: {
      'x-bs-handler': HANDLER,
      'cache-control': 'no-store',
    },
  });
  return res;
}
