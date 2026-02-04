import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCors, guardMethod, noStore, ensureRequestId } from '../lib/cors';
import { badRequest, ok } from '../lib/http';
import { getSimMode } from '../lib/env';
import { rateLimitMiddleware } from '../lib/rate';
import { trackApiError } from '../lib/error-tracking';
import { validateAndSanitize, simulateTransactionSchema } from '../lib/security/validation-schemas';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  let requestId = 'unknown';

  try {
    // Set CORS and cache headers first
    setCors(res, req);
    noStore(res);

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    if (!guardMethod(req, res, ['POST'])) return;

    // Ensure request ID is set before rate limiting
    requestId = ensureRequestId(res);

    // Rate limiting (only active if env vars are set)
    if (!rateLimitMiddleware(req, res)) {
      return;
    }

    // ========================================================================
    // Validação e Sanitização com Zod .strict() (Parameter Pollution prevention)
    // ========================================================================
    let body: unknown;
    try {
      if (typeof req.body === 'string') {
        body = JSON.parse(req.body);
      } else {
        body = req.body || {};
      }
    } catch (e) {
      badRequest(res, 'Corpo da requisição não é um JSON válido.', requestId);
      return;
    }

    let validated;
    try {
      validated = await validateAndSanitize(simulateTransactionSchema, body);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Validação falhou';
      badRequest(res, errorMessage, requestId);
      return;
    }

    const { mint } = validated;

    const score = 68;
    const grade = score >= 80 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'E';
    const mode = getSimMode();

    ok(
      res,
      {
        isSafe: score >= 80,
        shieldScore: score,
        grade,
        warnings: [],
        metadata: { mode, mintLength: mint.length, base: null },
      },
      requestId,
      { mode },
    );
    return;
  } catch (error) {
    requestId = ensureRequestId(res);
    trackApiError(error, req, {
      endpoint: '/api/simulate',
      source: 'simulate',
      requestId,
      metadata: { hasMint: !!req.body?.mint },
    });

    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    console.error('[simulate] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: isDev ? (error instanceof Error ? error.message : 'Internal server error') : 'Internal server error',
      },
      meta: { requestId },
    });
  }
}
