/**
 * Diagnóstico Helius — TEMPORÁRIO e PROTEGIDO.
 *
 * GET /api/diagnostics/helius
 * Requer header `x-diagnostic-token` igual à env `DIAGNOSTIC_TOKEN` (len >= 16).
 * Fail-closed: sem DIAGNOSTIC_TOKEN configurado → 404. Token errado → 404.
 *
 * NUNCA retorna key, query string ou URL completa — apenas metadados
 * sanitizados (present/length/valid/host) e resultado de getHealth/getAsset.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getHeliusDiagnostics, getHeliusRpcUrl } from '@/lib/helius';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TEST_MINT = 'FpVETpk3TpPRQhWxSs5FyDtvcrDFbTMm5LtttWSSBAGS';
const TIMEOUT_MS = 8_000;

/** Mint base58-like, 32-64 chars. Retorna null se inválido. */
function parseMintParam(raw: string | null): string | null {
  if (!raw) return null;
  const mint = raw.trim();
  if (mint.length < 32 || mint.length > 64) return null;
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(mint)) return null;
  return mint;
}

function jsonNoStore(body: unknown, status = 200) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
    },
  });
}

function notFound() {
  return jsonNoStore({ success: false, error: 'Not found' }, 404);
}

function safeTokenMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Remove qualquer coisa que pareça key/URL de uma mensagem de erro. */
function sanitizeMessage(msg: string): string {
  return msg
    .replace(/api[-_]key=[\w-]+/gi, 'api-key=[REDACTED]')
    .replace(/https?:\/\/\S+/gi, '[URL]')
    .slice(0, 160);
}

interface RpcProbeResult {
  ok: boolean;
  httpStatus: number | null;
  rpcErrorCode: number | null;
  rpcErrorMessage: string | null;
}

async function probeRpc(rpcUrl: string, method: string, params: unknown): Promise<RpcProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'diag', method, params }),
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    let rpcErrorCode: number | null = null;
    let rpcErrorMessage: string | null = null;
    let hasResult = false;
    try {
      const json = (await res.json()) as { result?: unknown; error?: { code?: number; message?: string } };
      hasResult = json?.result !== undefined && json?.result !== null;
      if (json?.error) {
        rpcErrorCode = typeof json.error.code === 'number' ? json.error.code : null;
        rpcErrorMessage = sanitizeMessage(String(json.error.message ?? ''));
      }
    } catch {
      // corpo não-JSON (ex.: 401 text) — só status HTTP
    }
    return { ok: res.ok && hasResult && !rpcErrorCode, httpStatus: res.status, rpcErrorCode, rpcErrorMessage };
  } catch (e) {
    clearTimeout(timer);
    const err = e as { name?: string; message?: string };
    return {
      ok: false,
      httpStatus: null,
      rpcErrorCode: null,
      rpcErrorMessage: err?.name === 'AbortError' ? 'Timeout' : sanitizeMessage(String(err?.message ?? 'error')),
    };
  }
}

export async function GET(req: NextRequest) {
  const expected = (process.env.DIAGNOSTIC_TOKEN ?? '').trim();
  if (!expected || expected.length < 16) return notFound();

  const provided = (req.headers.get('x-diagnostic-token') ?? '').trim();
  if (!provided || !safeTokenMatch(provided, expected)) return notFound();

  // Query param opcional ?mint= (base58-like, 32-64 chars). Inválido → 400.
  const rawMint = req.nextUrl.searchParams.get('mint');
  let testMint = TEST_MINT;
  if (rawMint !== null) {
    const parsed = parseMintParam(rawMint);
    if (!parsed) {
      return jsonNoStore({ success: false, error: 'Invalid mint param (expected base58, 32-64 chars).' }, 400);
    }
    testMint = parsed;
  }

  const diagnostics = getHeliusDiagnostics();
  const rpcUrl = getHeliusRpcUrl();

  let getHealth: RpcProbeResult | null = null;
  let getAsset: RpcProbeResult | null = null;
  if (rpcUrl) {
    [getHealth, getAsset] = await Promise.all([
      probeRpc(rpcUrl, 'getHealth', []),
      probeRpc(rpcUrl, 'getAsset', { id: testMint }),
    ]);
  }

  return jsonNoStore({
    success: true,
    response: {
      ts: new Date().toISOString(),
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
      helius: diagnostics,
      probes: {
        getHealth,
        getAsset: getAsset ? { ...getAsset, mint: testMint } : null,
        testedMint: testMint,
        mintSource: testMint === TEST_MINT ? 'default' : 'query',
      },
    },
  });
}
