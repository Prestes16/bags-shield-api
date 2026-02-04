/**
 * Stub implementations for Launchpad endpoints
 * Used when LAUNCHPAD_MODE=stub to avoid dependency on Bags upstream
 */

import type {
  TokenDraft,
  LaunchConfigDraft,
  PreflightReport,
  ShieldProofManifest,
} from "./types";
import { generateRequestId } from "../security/requestId";

/**
 * Stub response for create-token-info
 */
export function stubCreateTokenInfo(
  token: TokenDraft,
  requestId: string
): {
  tokenMint: string;
  tokenMetadata: unknown;
  tokenLaunch: unknown;
} {
  // Generate a mock mint address (base58, 44 chars)
  const mockMint =
    "Stub" +
    Array.from({ length: 40 }, () =>
      "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[
        Math.floor(Math.random() * 58)
      ]
    ).join("");

  return {
    tokenMint: mockMint,
    tokenMetadata: {
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      description: token.description,
      image: token.imageUrl,
      website: token.websiteUrl,
      twitter: token.twitterHandle,
      telegram: token.telegramHandle,
    },
    tokenLaunch: {
      status: "stub",
      message: "This is a stub response. Set LAUNCHPAD_MODE=real to use real Bags API.",
    },
  };
}

/**
 * Stub response for create-config
 */
export function stubCreateConfig(
  config: LaunchConfigDraft,
  requestId: string
): {
  configKey: string;
  tx: string | null;
} {
  // Generate a mock config key
  const mockConfigKey =
    "Stub" +
    Array.from({ length: 40 }, () =>
      "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[
        Math.floor(Math.random() * 58)
      ]
    ).join("");

  return {
    configKey: mockConfigKey,
    tx: null, // No transaction needed in stub mode
  };
}

/**
 * Stub preflight report
 */
export function stubPreflightReport(
  config: LaunchConfigDraft,
  requestId: string
): PreflightReport {
  const issues: PreflightReport["issues"] = [];
  const warnings: PreflightReport["warnings"] = [];

  // Basic validations
  if (!config.token.name || config.token.name.length < 1) {
    issues.push({
      path: "token.name",
      message: "Token name is required",
      severity: "error",
    });
  }

  if (!config.token.symbol || config.token.symbol.length < 1) {
    issues.push({
      path: "token.symbol",
      message: "Token symbol is required",
      severity: "error",
    });
  }

  if (config.token.decimals < 0 || config.token.decimals > 18) {
    issues.push({
      path: "token.decimals",
      message: "Decimals must be between 0 and 18",
      severity: "error",
    });
  }

  // Warnings
  if (!config.token.description || config.token.description.length < 10) {
    warnings.push({
      path: "token.description",
      message: "Description should be at least 10 characters",
    });
  }

  if (config.token.imageUrl && !config.token.imageUrl.startsWith("https://")) {
    warnings.push({
      path: "token.imageUrl",
      message: "HTTPS is recommended for image URLs",
    });
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    validatedAt: new Date().toISOString(),
    requestId,
  };
}

/**
 * Stub manifest
 */
export function stubManifest(
  mint: string,
  requestId: string
): ShieldProofManifest {
  // Generate a mock shield score based on mint (deterministic)
  const score = (mint.charCodeAt(0) % 100);
  const grade = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : score >= 20 ? "D" : "E";

  return {
    mint,
    shieldScore: score,
    grade,
    isSafe: score >= 70,
    badges: [
      {
        key: "stub_mode",
        title: "Stub Mode",
        severity: "low",
        impact: "neutral",
        tags: ["stub", "testing"],
      },
      {
        key: "validated",
        title: "Basic Validation",
        severity: "low",
        impact: "positive",
        tags: ["validation"],
      },
    ],
    summary: "Token validated in stub mode. Set LAUNCHPAD_MODE=real for full validation.",
    evaluatedAt: new Date().toISOString(),
    requestId,
  };
}
