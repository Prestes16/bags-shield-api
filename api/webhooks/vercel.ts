import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'node:crypto';
import { preflight, guardMethod, ensureRequestId } from '../../lib/cors';
import { unauthorized, ok } from '../../lib/http';
import { trackApiError } from '../../lib/error-tracking';

/**
 * Validates Vercel webhook signature using HMAC-SHA1.
 * Vercel sends x-vercel-signature header with HMAC-SHA1 of raw body.
 */
function validateVercelSignature(rawBody: string, signature: string, secret: string): boolean {
  if (!secret || !signature || !rawBody) {
    return false;
  }

  const hmac = createHmac('sha1', secret);
  hmac.update(rawBody);
  const expectedSignature = hmac.digest('hex');

  // Vercel sends signature as hex string
  // Use constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  let match = 0;
  for (let i = 0; i < signature.length; i++) {
    match |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }

  return match === 0;
}

/**
 * Safely extracts event type from webhook payload.
 */
function getEventType(body: unknown): string {
  if (typeof body === 'object' && body !== null) {
    const obj = body as Record<string, unknown>;
    if (typeof obj.type === 'string') {
      return obj.type;
    }
    if (typeof obj.event === 'string') {
      return obj.event;
    }
  }
  return 'unknown';
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const requestId = ensureRequestId(res);

  try {
    if (req.method === 'OPTIONS') {
      preflight(res, ['POST'], ['Content-Type', 'Authorization', 'x-api-key'], req);
      return;
    }

    if (!guardMethod(req, res, ['POST'])) return;

    const secret = process.env.INTEGRATION_SECRET;

    if (!secret) {
      unauthorized(res, 'INTEGRATION_SECRET not configured', requestId);
      return;
    }

    // Get raw body for signature validation
    // In Vercel Functions, req.body is already parsed, so we need to reconstruct
    // For webhooks, we should read the raw body, but Vercel may have already parsed it
    // We'll validate with the stringified body as a fallback
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});

    const signature =
      (req.headers['x-vercel-signature'] as string | undefined) ||
      (req.headers['x-vercel-signature'.toLowerCase()] as string | undefined);

    if (!signature) {
      unauthorized(res, 'Missing x-vercel-signature header', requestId);
      return;
    }

    // Validate signature
    const isValid = validateVercelSignature(rawBody, signature, secret);

    if (!isValid) {
      // Log failed attempt safely (no sensitive data)
      console.warn(`[webhook] Invalid signature - requestId: ${requestId}`);
      unauthorized(res, 'Invalid signature', requestId);
      return;
    }

    // Extract event type safely
    const eventType = getEventType(req.body);

    // Log successful webhook (safely, no sensitive data)
    console.log(`[webhook] Valid webhook received - requestId: ${requestId}, eventType: ${eventType}`);

    // Acknowledge webhook (no actions triggered yet)
    ok(
      res,
      {
        acknowledged: true,
        eventType,
        timestamp: new Date().toISOString(),
      },
      requestId,
      {
        upstream: 'vercel',
        mode: 'webhook',
      },
    );
  } catch (error: any) {
    trackApiError(error, req, {
      endpoint: '/api/webhooks/vercel',
      source: 'webhook',
      requestId,
      metadata: { hasSignature: !!req.headers['x-vercel-signature'] },
    });

    console.error('[webhook] Error:', error?.message || String(error));
    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    res.status(500).json({
      success: false,
      error: 'webhook_error',
      message: isDev ? error?.message || String(error) : 'Erro interno ao processar webhook',
      meta: { requestId },
    });
  }
}
