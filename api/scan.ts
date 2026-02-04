import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCors, preflight, guardMethod, noStore, ensureRequestId } from '../lib/cors';
import { trackApiError } from '../lib/error-tracking';

function isBase64Like(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  if (s.length < 32) return false;
  if (s.length > 200_000) return false; // guarda pra não virar lixão
  // base64 padrão (+/) ou urlsafe (-_)
  return /^[A-Za-z0-9+/_-]+={0,2}$/.test(s);
}

function parseBody(req: VercelRequest): any {
  if (typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      throw new Error('invalid json');
    }
  }
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  let requestId = 'unknown';

  try {
    requestId = ensureRequestId(res);

    setCors(res, req);
    if (req.method === 'OPTIONS') {
      return preflight(res, ['POST'], ['Content-Type', 'Authorization', 'x-api-key'], req);
    }
    if (!guardMethod(req, res, ['POST'])) return;

    noStore(res);

    let body: any;
    try {
      body = parseBody(req);
    } catch (e: any) {
      res.status(400).json({
        success: false,
        error: 'invalid json',
        meta: { requestId },
      });
      return;
    }

    const rawTransaction = body?.rawTransaction ?? body?.raw_transaction ?? body?.tx ?? '';
    const network = (body?.network ?? 'mainnet').toString();
    const wallet = body?.wallet ? String(body.wallet) : undefined;
    const source = body?.source ? String(body.source) : undefined;

    if (!isBase64Like(rawTransaction)) {
      res.status(400).json({
        success: false,
        error: 'invalid rawTransaction (expected base64 string)',
        meta: { requestId },
      });
      return;
    }

    // MOCK v0 (pronto pra plugar scan real depois)
    const shieldScore = 80;
    const grade = 'B';
    const badges = [
      { id: 'tx_format', severity: 'low', label: 'Transaction format OK' },
      { id: 'precheck', severity: 'low', label: 'Pre-check passed' },
    ];

    res.status(200).json({
      success: true,
      response: {
        isSafe: true,
        shieldScore,
        grade,
        warnings: [],
        badges,
        meta: { network, wallet, source, requestId },
      },
      meta: { requestId },
    });
    return;
  } catch (e: any) {
    trackApiError(e, req, {
      endpoint: '/api/scan',
      source: 'scan',
      requestId,
      metadata: { hasTransaction: !!req.body },
    });

    console.error('[scan] Error:', e?.message || String(e));
    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    const errorMessage = isDev ? e?.message || String(e) : 'internal server error';
    res.status(500).json({
      success: false,
      error: 'scan_failed',
      message: errorMessage,
      meta: { requestId },
    });
    return;
  }
}
