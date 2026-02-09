/**
 * Token Creator — scaffold only. Feature flag FEATURE_TOKEN_CREATOR must be true for real implementation.
 * Security: auth admin + allowlist + limits (designed for future use).
 */

export const FEATURE_TOKEN_CREATOR =
  process.env.FEATURE_TOKEN_CREATOR === 'true' || process.env.FEATURE_TOKEN_CREATOR === '1';

export function isTokenCreatorEnabled(): boolean {
  return FEATURE_TOKEN_CREATOR;
}
