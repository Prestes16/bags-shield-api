/**
 * POST /api/launchpad/manifest
 *
 * Generates ShieldProofManifest with HMAC signature.
 * Takes normalized payload, generates hash, and signs with HMAC.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getOrGenerateRequestId,
  safeJsonParse,
  checkRateLimitByIp,
  checkIdempotencyKey,
  SafeLogger,
} from '@/src/lib/security';
import { handlePreflight } from '@/src/lib/security/cors';
import { checkLaunchpadEnabled, setupSecurityHeaders } from '@/src/lib/launchpad/middleware';
import { shieldProofManifestSchema, validateLaunchpadInput } from '@/src/lib/launchpad/schemas';
import type { ShieldProofManifest } from '@/src/lib/launchpad/types';
import { createHmac, createHash } from 'crypto';

interface ManifestRequest {
  mint: string;
  shieldScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  isSafe: boolean;
  badges: Array<{
    key: string;
    title: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    impact: 'negative' | 'neutral' | 'positive';
    tags: string[];
  }>;
  summary: string;
}

/**
 * Normalize payload for hashing (deterministic JSON stringify)
 */
function normalizePayload(payload: ManifestRequest): string {
  // Sort keys for deterministic output
  const normalized = {
    mint: payload.mint,
    shieldScore: payload.shieldScore,
    grade: payload.grade,
    isSafe: payload.isSafe,
    badges: payload.badges
      .map((b) => ({
        key: b.key,
        title: b.title,
        severity: b.severity,
        impact: b.impact,
        tags: [...b.tags].sort(),
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    summary: payload.summary,
  };

  return JSON.stringify(normalized);
}

/**
 * Generate HMAC signature for manifest
 */
function generateHMAC(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

/**
 * Generate hash of payload
 */
function generateHash(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req, ['POST']);
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let requestId = getOrGenerateRequestId(req.headers);

  // Check feature flag
  const featureCheck = checkLaunchpadEnabled(req, '/api/launchpad/manifest');
  if (featureCheck) return featureCheck;

  // Apply security headers
  let res = setupSecurityHeaders(req, requestId);

  // Rate limiting by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const route = '/api/launchpad/manifest';
  const rateLimitCheck = checkRateLimitByIp(ip, route);
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded',
        },
        meta: { requestId },
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': '20',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimitCheck.resetAt),
        },
      },
    );
  }

  // Idempotency check (optional)
  const idempotencyKey = req.headers.get('Idempotency-Key');
  if (idempotencyKey) {
    const idempotencyCheck = checkIdempotencyKey(idempotencyKey, route);
    if (idempotencyCheck && !idempotencyCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'IDEMPOTENCY_KEY_CONFLICT',
            message: 'Request with this idempotency key already processed',
          },
          meta: { requestId },
        },
        { status: 409 },
      );
    }
  }

  // Content-Type check
  const contentType = req.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Content-Type must be application/json',
        },
        issues: [
          {
            path: 'headers.content-type',
            message: 'Expected application/json',
          },
        ],
        meta: { requestId },
      },
      { status: 415 },
    );
  }

  // Safe JSON parsing
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Failed to read request body',
        },
        issues: [
          {
            path: '<root>',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  const parseResult = safeJsonParse<ManifestRequest>(bodyText);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: parseResult.error || 'Invalid JSON',
        },
        issues: parseResult.issues || [],
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  // Validate manifest request structure
  const validation = validateLaunchpadInput(shieldProofManifestSchema, {
    ...parseResult.data,
    evaluatedAt: new Date().toISOString(),
    requestId,
  });

  if (!validation.ok) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed',
        },
        issues: 'issues' in validation ? validation.issues : [],
        meta: { requestId },
      },
      { status: 400 },
    );
  }

  // Generate manifest
  const normalizedPayload = normalizePayload(parseResult.data);
  const payloadHash = generateHash(normalizedPayload);

  // Get HMAC secret from env (never log it). In production, require explicit secret.
  const hmacSecret =
    process.env.LAUNCHPAD_HMAC_SECRET ||
    (process.env.NODE_ENV !== 'production' ? 'default-secret-change-in-production' : '');
  if (!hmacSecret) {
    SafeLogger.warn('LAUNCHPAD_HMAC_SECRET not set in production', { requestId });
    return NextResponse.json(
      { success: false, error: 'Server configuration error', code: 'HMAC_NOT_CONFIGURED' },
      { status: 503 },
    );
  }
  const signature = generateHMAC(normalizedPayload, hmacSecret);

  const manifest: ShieldProofManifest = {
    mint: parseResult.data.mint,
    shieldScore: parseResult.data.shieldScore,
    grade: parseResult.data.grade,
    isSafe: parseResult.data.isSafe,
    badges: parseResult.data.badges,
    summary: parseResult.data.summary,
    evaluatedAt: new Date().toISOString(),
    requestId,
  };

  SafeLogger.info('Manifest generated successfully', {
    requestId,
    endpoint: '/api/launchpad/manifest',
    mint: manifest.mint,
    shieldScore: manifest.shieldScore,
    grade: manifest.grade,
    elapsedMs: Date.now() - startTime,
  });

  // Add hash and signature to response (not in manifest type, but in response)
  return NextResponse.json(
    {
      success: true,
      response: {
        ...manifest,
        payloadHash,
        signature,
      },
      meta: {
        requestId,
        elapsedMs: Date.now() - startTime,
      },
    },
    { status: 200 },
  );
}
