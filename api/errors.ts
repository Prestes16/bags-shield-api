import type { VercelRequest, VercelResponse } from '@vercel/node';
import { errorTracker } from '../lib/error-tracking';

/**
 * Endpoint para visualizar erros rastreados
 * GET /api/errors?source=helius&severity=high&limit=50
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    // Apenas GET permitido
    if (req.method !== 'GET') {
      res.status(405).json({
        success: false,
        error: 'method_not_allowed',
        message: 'Apenas GET é permitido',
      });
      return;
    }

    // Parse query parameters
    const source = req.query.source as string | undefined;
    const severity = req.query.severity as 'low' | 'medium' | 'high' | 'critical' | undefined;
    const resolved = req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined;
    const limit = Math.min(Number(req.query.limit) || 100, 500); // Máximo 500
    const sinceHours = Number(req.query.sinceHours) || undefined;

    // Filtro de data
    let since: Date | undefined;
    if (sinceHours) {
      since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    }

    // Obtém erros filtrados
    const errors = errorTracker.getErrors({
      source,
      severity,
      resolved,
      since,
    });

    // Limita resultados
    const limitedErrors = errors.slice(-limit);

    // Obtém estatísticas
    const stats = errorTracker.getStats();

    // Resposta
    res.status(200).json({
      success: true,
      response: {
        errors: limitedErrors,
        total: errors.length,
        limited: limitedErrors.length,
        stats,
        filters: {
          source,
          severity,
          resolved,
          limit,
          sinceHours,
        },
      },
      meta: {
        requestId: `req_${Date.now()}`,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  } catch (error: any) {
    console.error('[errors] Error:', error?.message || String(error));
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: error?.message || 'Erro ao obter erros rastreados',
    });
    return;
  }
}
