/**
 * Secure Scan Endpoint - Refatorado com Zod .strict()
 *
 * Este é um exemplo de como refatorar api/scan.ts para usar
 * validação Zod com .strict() para prevenir Parameter Pollution
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCors, preflight, guardMethod, noStore, ensureRequestId } from '../lib/cors';
import { trackApiError } from '../lib/error-tracking';
import { validateAndSanitize, scanTransactionSchema } from '../lib/security/validation-schemas';

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

    // ========================================================================
    // Validação e Sanitização com Zod .strict()
    // ========================================================================
    // Isso rejeita qualquer campo extra (Parameter Pollution prevention)
    let body: unknown;
    try {
      if (typeof req.body === 'string') {
        body = JSON.parse(req.body);
      } else {
        body = req.body || {};
      }
    } catch (e) {
      res.status(400).json({
        success: false,
        error: 'invalid_json',
        message: 'Corpo da requisição não é um JSON válido',
        meta: { requestId },
      });
      return;
    }

    // Validar e sanitizar com Zod .strict()
    // Campos extras serão rejeitados automaticamente
    const validated = await validateAndSanitize(scanTransactionSchema, body);

    // ========================================================================
    // Processar scan (exemplo - implementar lógica real)
    // ========================================================================
    const { rawTransaction, network } = validated;

    // MOCK v0 (pronto pra plugar scan real depois)
    const shieldScore = 80;
    const grade = 'B';
    const badges = [
      { id: 'tx_format', severity: 'low', label: 'Transaction format OK' },
      { id: 'precheck', severity: 'low', label: 'Pre-check passed' },
      { id: 'input_validated', severity: 'low', label: 'Input validation passed' },
    ];

    res.status(200).json({
      success: true,
      response: {
        isSafe: true,
        shieldScore,
        grade,
        warnings: [],
        badges,
        meta: { network, requestId },
      },
      meta: { requestId },
    });
    return;
  } catch (e: unknown) {
    // ========================================================================
    // Tratamento de Erro
    // ========================================================================
    if (e instanceof Error && e.message.includes('Validação falhou')) {
      res.status(400).json({
        success: false,
        error: 'validation_error',
        message: e.message,
        meta: { requestId },
      });
      return;
    }

    trackApiError(e, req, {
      endpoint: '/api/scan',
      source: 'scan',
      requestId,
      metadata: { hasBody: !!req.body },
    });

    console.error('[scan] Error:', e instanceof Error ? e.message : String(e));
    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    const errorMessage = isDev ? (e instanceof Error ? e.message : String(e)) : 'internal server error';
    res.status(500).json({
      success: false,
      error: 'scan_failed',
      message: errorMessage,
      meta: { requestId },
    });
    return;
  }
}
