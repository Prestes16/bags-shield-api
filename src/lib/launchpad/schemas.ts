/**
 * Zod Schemas for Bags Shield Launchpad
 *
 * Strict validation schemas with additionalProperties: false behavior.
 * All schemas follow fail-closed principle: invalid input = validation error with issues[].
 */

import { z } from 'zod';
import type { TokenDraft, LaunchConfigDraft, PreflightReport, ShieldProofManifest } from './types';

/**
 * Base58 validation regex (Solana addresses)
 * Pattern: ^[1-9A-HJ-NP-Za-km-z]{32,44}$
 * Excludes: 0, O, I, l (para evitar ambiguidade)
 */
const BASE58_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * ValidaÃ§Ã£o de endereÃ§o Solana (mint ou pubkey)
 */
const solanaAddressSchema = z
  .string()
  .min(32, 'EndereÃ§o deve ter no mÃ­nimo 32 caracteres')
  .max(44, 'EndereÃ§o deve ter no mÃ¡ximo 44 caracteres')
  .regex(BASE58_PATTERN, 'EndereÃ§o deve ser base58 vÃ¡lido (sem 0, O, I, l)');

/**
 * ValidaÃ§Ã£o de URL HTTP/HTTPS com proteÃ§Ã£o anti-SSRF
 */
function createUrlSchema(fieldName: string) {
  return z
    .string()
    .url(`Campo '${fieldName}' deve ser uma URL vÃ¡lida`)
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          // Apenas HTTP/HTTPS permitidos
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return false;
          }

          const hostname = parsed.hostname.toLowerCase();

          // Bloquear localhost e variaÃ§Ãµes
          const blockedHosts = [
            'localhost',
            '127.0.0.1',
            '0.0.0.0',
            '::1',
            '169.254.169.254', // AWS metadata
          ];

          if (blockedHosts.includes(hostname)) {
            return false;
          }

          // Bloquear IPs privados (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
          const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
          if (ipRegex.test(hostname)) {
            const parts = hostname.split('.').map(Number);
            const isPrivate =
              parts[0] === 10 ||
              (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
              (parts[0] === 192 && parts[1] === 168);

            if (isPrivate) {
              return false;
            }
          }

          // Bloquear file://
          if (url.startsWith('file://')) {
            return false;
          }

          // Opcional: allowlist de domÃ­nios (via env var)
          // Usa env var diretamente (refinements nÃ£o podem usar imports dinÃ¢micos)
          const allowedDomainsEnv = process.env.ALLOWED_IMAGE_DOMAINS;
          if (allowedDomainsEnv) {
            const allowedDomains = allowedDomainsEnv
              .split(',')
              .map((d) => d.trim().toLowerCase())
              .filter(Boolean);
            if (allowedDomains.length > 0) {
              return allowedDomains.includes(hostname);
            }
          }

          return true;
        } catch {
          return false;
        }
      },
      {
        message: `Campo '${fieldName}' deve ser uma URL HTTP/HTTPS pÃºblica vÃ¡lida (localhost e IPs privados nÃ£o permitidos)`,
      },
    )
    .optional();
}

/**
 * Schema para TokenDraft
 */
export const tokenDraftSchema = z
  .object({
    name: z.string().min(1, 'Nome do token Ã© obrigatÃ³rio').max(32, 'Nome do token deve ter no mÃ¡ximo 32 caracteres'),

    symbol: z
      .string()
      .min(1, 'SÃ­mbolo do token Ã© obrigatÃ³rio')
      .max(10, 'SÃ­mbolo do token deve ter no mÃ¡ximo 10 caracteres'),

    decimals: z
      .number()
      .int('Decimais deve ser um nÃºmero inteiro')
      .min(0, 'Decimais deve ser >= 0')
      .max(18, 'Decimais deve ser <= 18'),

    description: z.string().max(200, 'DescriÃ§Ã£o deve ter no mÃ¡ximo 200 caracteres').optional(),

    /** URL real (http/https/ipfs/ar). NÃO aceita data: (use imagePreviewUrl para preview) */
    imageUrl: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          if (val.startsWith('data:')) return false; // data: só em imagePreviewUrl
          try {
            const u = new URL(val);
            return ['http:', 'https:', 'ipfs:', 'ar:'].includes(u.protocol);
          } catch {
            return false;
          }
        },
        { message: 'imageUrl deve ser URL http://, https://, ipfs:// ou ar:// (sem data:)' },
      ),
    /** Data URL para preview (máx 200KB). Não persiste em localStorage. */
    imagePreviewUrl: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          if (!val.startsWith('data:image/') || !val.includes(';base64,')) return false;
          return val.length <= 200_000; // ~200KB limite anti-payload bomb
        },
        { message: 'imagePreviewUrl deve ser data:image/*;base64, com máx 200KB' },
      ),

    websiteUrl: createUrlSchema('websiteUrl'),

    twitterHandle: z
      .string()
      .regex(/^[a-zA-Z0-9_]{1,15}$/, 'Twitter handle deve ter 1-15 caracteres alfanumÃ©ricos ou underscore (sem @)')
      .optional(),

    telegramHandle: z
      .string()
      .regex(/^[a-zA-Z0-9_]{5,32}$/, 'Telegram handle deve ter 5-32 caracteres alfanumÃ©ricos ou underscore')
      .optional(),
  })
  .strict(); // additionalProperties: false

const safetyConfigSchema = z
  .object({
    renounceMint: z.boolean(),
    renounceFreeze: z.boolean(),
    lpLockMonths: z.number().int().min(0).max(60),
  })
  .optional();

/**
 * Schema para LaunchConfigDraft
 */
export const launchConfigDraftSchema = z
  .object({
    launchWallet: solanaAddressSchema,

    tipWallet: solanaAddressSchema.optional(),

    tipLamports: z
      .number()
      .int('tipLamports deve ser um nÃºmero inteiro')
      .nonnegative('tipLamports deve ser >= 0')
      .optional(),

    initialSupply: z.number().int().nonnegative().optional(),

    safetyConfig: safetyConfigSchema,

    token: tokenDraftSchema,

    metadata: z.record(z.unknown()).optional(),
  })
  .strict() // additionalProperties: false
  .refine(
    (data) => {
      // Se tipWallet fornecido, tipLamports deve ser fornecido e > 0
      if (data.tipWallet && (!data.tipLamports || data.tipLamports <= 0)) {
        return false;
      }
      return true;
    },
    {
      message: 'tipLamports Ã© obrigatÃ³rio e deve ser > 0 quando tipWallet Ã© fornecido',
      path: ['tipLamports'],
    },
  );

/**
 * Schema para PreflightReport
 */
export const preflightReportSchema = z
  .object({
    isValid: z.boolean(),

    issues: z.array(
      z.object({
        path: z.string().min(1, 'Path Ã© obrigatÃ³rio'),
        message: z.string().min(1, 'Message Ã© obrigatÃ³rio'),
        severity: z.enum(['error', 'warning', 'info']),
      }),
    ),

    warnings: z.array(
      z.object({
        path: z.string().min(1, 'Path Ã© obrigatÃ³rio'),
        message: z.string().min(1, 'Message Ã© obrigatÃ³rio'),
      }),
    ),

    validatedAt: z.string().datetime('validatedAt deve ser ISO 8601'),

    requestId: z.string().uuid('requestId deve ser UUID vÃ¡lido'),
  })
  .strict(); // additionalProperties: false

/**
 * Schema para ShieldProofManifest
 */
export const shieldProofManifestSchema = z
  .object({
    mint: solanaAddressSchema,

    shieldScore: z
      .number()
      .int('shieldScore deve ser inteiro')
      .min(0, 'shieldScore deve ser >= 0')
      .max(100, 'shieldScore deve ser <= 100'),

    grade: z.enum(['A', 'B', 'C', 'D', 'E']),

    isSafe: z.boolean(),

    badges: z.array(
      z.object({
        key: z.string().min(1).max(64),
        title: z.string().min(1).max(80),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        impact: z.enum(['negative', 'neutral', 'positive']),
        tags: z.array(z.string().min(1).max(32)).max(16),
      }),
    ),

    summary: z.string().min(1),

    evaluatedAt: z.string().datetime('evaluatedAt deve ser ISO 8601'),

    requestId: z.string().uuid('requestId deve ser UUID vÃ¡lido'),
  })
  .strict(); // additionalProperties: false

/**
 * Helper para validar e retornar issues[] em formato padronizado
 */
export function validateLaunchpadInput<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { ok: true; data: T } | { ok: false; issues: Array<{ path: string; message: string }> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { ok: true, data: result.data };
  }

  const issues = result.error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '<root>',
    message: issue.message,
  }));

  return { ok: false, issues };
}




