import type { VercelRequest, VercelResponse } from '@vercel/node';

const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES) || 512 * 1024; // 512KB

/**
 * Valida tamanho do body. Retorna true se OK, false se rejeitou (já enviou resposta).
 */
export function validatePayloadSize(req: VercelRequest, res: VercelResponse, requestId?: string): boolean {
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    res.status(413).json({
      success: false,
      error: 'payload_too_large',
      message: `Body maior que ${MAX_BODY_BYTES} bytes`,
      meta: requestId ? { requestId } : undefined,
    });
    return false;
  }
  return true;
}
