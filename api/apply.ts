import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { setCors, guardMethod, noStore, ensureRequestId } from '../lib/cors';
import { rateLimitMiddleware } from '../lib/rate';
import { trackApiError } from '../lib/error-tracking';

/**
 * Schema de validação para /api/apply
 *
 * Usa .strict() para prevenir Parameter Pollution
 */
const applySchema = z
  .object({
    // Campos opcionais - endpoint pode receber qualquer payload
    // mas campos extras são rejeitados
  })
  .strict();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Tratamento CORS manual sÃ³ para OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  // Para os demais métodos, usamos o pipeline padrão
  setCors(res, req);
  noStore(res);

  if (!guardMethod(req, res, ['POST'])) return;

  // Rate limiting (only active if env vars are set)
  if (!rateLimitMiddleware(req, res)) {
    return;
  }

  const requestId = ensureRequestId(res);

  try {
    // ========================================================================
    // Validação com Zod .strict() (Parameter Pollution prevention)
    // ========================================================================
    let body: unknown;
    try {
      if (typeof req.body === 'string') {
        body = JSON.parse(req.body);
      } else {
        body = req.body || {};
      }
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'invalid_json',
        message: 'Corpo da requisição não é um JSON válido',
        meta: { requestId },
      });
    }

    // Validar com .strict() - rejeita campos extras
    try {
      await applySchema.parseAsync(body);
    } catch (e) {
      if (e instanceof z.ZodError) {
        const messages = e.errors.map((err) => `${err.path.join('.')}: ${err.message}`);
        return res.status(400).json({
          success: false,
          error: 'validation_error',
          message: `Validação falhou: ${messages.join(', ')}`,
          meta: { requestId },
        });
      }
      throw e;
    }

    return res.status(200).json({
      success: true,
      response: { applied: true },
      meta: { requestId },
    });
  } catch (err: unknown) {
    trackApiError(err, req, {
      endpoint: '/api/apply',
      source: 'apply',
      requestId,
    });

    console.error('[apply] Error:', err?.message || String(err));
    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: isDev ? err?.message || String(err) : 'internal server error',
      meta: { requestId },
    });
  }
}
