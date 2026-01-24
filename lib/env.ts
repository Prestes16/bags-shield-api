import { z } from "zod";

/**
 * Schema de validação para variáveis de ambiente.
 * Usa fallbacks seguros para manter demo/dev funcionando.
 */
const EnvSchema = z.object({
  // Bags API Configuration
  BAGS_API_BASE: z
    .string()
    .optional()
    .transform((val: string | undefined) => {
      if (!val) return null;
      const trimmed = val.trim();
      if (!trimmed) return null;
      try {
        const url = new URL(trimmed);
        return url.toString().replace(/\/+$/, "");
      } catch {
        return null;
      }
    }),
  BAGS_API_KEY: z
    .string()
    .optional()
    .transform((val: string | undefined) => {
      if (!val) return null;
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
  BAGS_TIMEOUT_MS: z
    .string()
    .optional()
    .default("15000")
    .transform((val: string | undefined) => {
      const parsed = Number(val);
      if (!Number.isFinite(parsed) || parsed <= 0) return 15000;
      return parsed;
    }),
  BAGS_ALLOW_MOCK_FALLBACK: z
    .string()
    .optional()
    .transform((val: string | undefined) => {
      if (!val) return false;
      const s = val.toLowerCase().trim();
      return s === "1" || s === "true" || s === "yes" || s === "on";
    }),

  // Mode Configuration (mock/prod/preview/dev)
  BAGS_SCAN_MODE: z
    .enum(["mock", "prod", "preview", "dev"])
    .optional()
    .default("mock"),
  BAGS_SIM_MODE: z
    .enum(["mock", "prod", "preview", "dev"])
    .optional()
    .default("mock"),

  // CORS Configuration
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((val: string | undefined): string | string[] => {
      if (!val) return "*";
      const trimmed = val.trim();
      if (!trimmed) return "*";
      return trimmed.split(",").map((s: string) => s.trim()).filter(Boolean);
    }),

  // Vercel/Node Environment
  VERCEL_ENV: z.string().optional(),
  NODE_ENV: z.string().optional(),

  // Optional: Auth & RPC
  BAGS_BEARER: z.string().optional(),
  SOLANA_RPC_URL: z
    .string()
    .optional()
    .transform((val: string | undefined) => {
      if (!val || val.trim() === "") return null;
      try {
        new URL(val);
        return val;
      } catch {
        return null;
      }
    }),

  // Launchpad Feature Flags
  LAUNCHPAD_ENABLED: z
    .string()
    .optional()
    .transform((val: string | undefined) => {
      if (!val) return false;
      const s = val.toLowerCase().trim();
      return s === "1" || s === "true" || s === "yes" || s === "on";
    }),
  LAUNCHPAD_MODE: z
    .enum(["stub", "real"])
    .optional()
    .default("stub"),
  ALLOWED_IMAGE_DOMAINS: z
    .string()
    .optional()
    .transform((val: string | undefined) => {
      if (!val || val.trim() === "") return null;
      return val
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
    }),

  // Bags Shield API Backend (for proxy routes)
  BAGS_SHIELD_API_BASE: z
    .string()
    .optional()
    .transform((val: string | undefined) => {
      if (!val) return null;
      const trimmed = val.trim();
      if (!trimmed) return null;
      try {
        const url = new URL(trimmed);
        return url.toString().replace(/\/+$/, "");
      } catch {
        return null;
      }
    }),
});

type EnvConfig = z.infer<typeof EnvSchema>;

let cachedEnv: EnvConfig | null = null;

/**
 * Lê e valida variáveis de ambiente uma vez, com cache.
 * Fail-closed apenas para variáveis críticas em produção.
 */
export function getEnv(): EnvConfig {
  if (cachedEnv) return cachedEnv;

  try {
    // Safe env access for non-Node environments
    const ENV: Record<string, string | undefined> =
      typeof process !== "undefined" && process.env ? (process.env as any) : {};

    const raw = {
      BAGS_API_BASE: ENV.BAGS_API_BASE,
      BAGS_API_KEY: ENV.BAGS_API_KEY,
      BAGS_TIMEOUT_MS: ENV.BAGS_TIMEOUT_MS,
      BAGS_ALLOW_MOCK_FALLBACK: ENV.BAGS_ALLOW_MOCK_FALLBACK,
      BAGS_SCAN_MODE: ENV.BAGS_SCAN_MODE,
      BAGS_SIM_MODE: ENV.BAGS_SIM_MODE,
      CORS_ORIGINS: ENV.CORS_ORIGINS,
      VERCEL_ENV: ENV.VERCEL_ENV,
      NODE_ENV: ENV.NODE_ENV,
      BAGS_BEARER: ENV.BAGS_BEARER,
      SOLANA_RPC_URL: ENV.SOLANA_RPC_URL,
      LAUNCHPAD_ENABLED: ENV.LAUNCHPAD_ENABLED,
      LAUNCHPAD_MODE: ENV.LAUNCHPAD_MODE,
      ALLOWED_IMAGE_DOMAINS: ENV.ALLOWED_IMAGE_DOMAINS,
      BAGS_SHIELD_API_BASE: ENV.BAGS_SHIELD_API_BASE,
    };

    const result = EnvSchema.safeParse(raw);
    if (!result.success) {
      // Em caso de erro de validação, usa defaults seguros
      console.warn("[env] Validation failed, using defaults:", result.error);
      cachedEnv = {
      BAGS_API_BASE: null,
      BAGS_API_KEY: null,
      BAGS_TIMEOUT_MS: 15000,
      BAGS_ALLOW_MOCK_FALLBACK: false,
      BAGS_SCAN_MODE: "mock",
      BAGS_SIM_MODE: "mock",
      CORS_ORIGINS: "*",
      VERCEL_ENV: undefined,
      NODE_ENV: undefined,
      BAGS_BEARER: undefined,
      SOLANA_RPC_URL: null,
      LAUNCHPAD_ENABLED: false,
      LAUNCHPAD_MODE: "stub",
      ALLOWED_IMAGE_DOMAINS: null,
      BAGS_SHIELD_API_BASE: null,
    };
    return cachedEnv;
  }

    cachedEnv = result.data;
    return cachedEnv;
  } catch (error) {
    // Fallback seguro em caso de erro inesperado
    console.error("[env] Unexpected error, using defaults:", error);
    cachedEnv = {
      BAGS_API_BASE: null,
      BAGS_API_KEY: null,
      BAGS_TIMEOUT_MS: 15000,
      BAGS_ALLOW_MOCK_FALLBACK: false,
      BAGS_SCAN_MODE: "mock",
      BAGS_SIM_MODE: "mock",
      CORS_ORIGINS: "*",
      VERCEL_ENV: undefined,
      NODE_ENV: undefined,
      BAGS_BEARER: undefined,
      SOLANA_RPC_URL: null,
      LAUNCHPAD_ENABLED: false,
      LAUNCHPAD_MODE: "stub",
      ALLOWED_IMAGE_DOMAINS: null,
      BAGS_SHIELD_API_BASE: null,
    };
    return cachedEnv;
  }
}

/**
 * Helper: retorna BAGS_API_BASE com fallback para default.
 */
export function getBagsBase(): string {
  const env = getEnv();
  return env.BAGS_API_BASE ?? "https://public-api-v2.bags.fm/api/v1";
}

/**
 * Helper: retorna BAGS_API_KEY (pode ser null em dev/mock).
 */
export function getBagsApiKey(): string | null {
  return getEnv().BAGS_API_KEY;
}

/**
 * Helper: verifica se Bags está configurado (base + key).
 */
export function isBagsConfigured(): boolean {
  const env = getEnv();
  return env.BAGS_API_BASE !== null && env.BAGS_API_KEY !== null;
}

/**
 * Helper: retorna timeout em ms (com fallback).
 */
export function getBagsTimeoutMs(): number {
  return getEnv().BAGS_TIMEOUT_MS;
}

/**
 * Helper: retorna CORS origins (array ou "*").
 */
export function getCorsOrigins(): string | string[] {
  return getEnv().CORS_ORIGINS;
}

/**
 * Helper: retorna modo de scan (mock/prod/preview/dev).
 */
export function getScanMode(): "mock" | "prod" | "preview" | "dev" {
  return getEnv().BAGS_SCAN_MODE;
}

/**
 * Helper: retorna modo de simulação (mock/prod/preview/dev).
 */
export function getSimMode(): "mock" | "prod" | "preview" | "dev" {
  return getEnv().BAGS_SIM_MODE;
}

/**
 * Helper: verifica se está em produção.
 */
export function isProduction(): boolean {
  const env = getEnv();
  return env.VERCEL_ENV === "production" || env.NODE_ENV === "production";
}

/**
 * Helper: verifica se Launchpad está habilitado.
 */
export function isLaunchpadEnabled(): boolean {
  return getEnv().LAUNCHPAD_ENABLED === true;
}

/**
 * Helper: retorna modo da Launchpad (stub|real).
 */
export function getLaunchpadMode(): "stub" | "real" {
  return getEnv().LAUNCHPAD_MODE;
}

/**
 * Helper: retorna allowlist de domínios para imageUrl (null se não configurado).
 */
export function getAllowedImageDomains(): string[] | null {
  return getEnv().ALLOWED_IMAGE_DOMAINS;
}

/**
 * Helper: retorna BAGS_SHIELD_API_BASE (null se não configurado).
 */
export function getBagsShieldApiBase(): string | null {
  return getEnv().BAGS_SHIELD_API_BASE;
}
