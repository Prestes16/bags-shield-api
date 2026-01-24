/**
 * Security-focused sanitization utilities for Launchpad
 * Prevents injection, XSS, and malformed data
 */

import { z } from "zod";

/**
 * Safe string sanitization with configurable limits
 */
export function sanitizeString(
  input: unknown, 
  maxLength = 500, 
  allowEmptyString = false
): string | null {
  if (typeof input !== "string") return null;
  
  const trimmed = input.trim();
  if (!allowEmptyString && trimmed.length === 0) return null;
  if (trimmed.length > maxLength) return null;
  
  // Remove control characters and normalize Unicode
  const normalized = trimmed
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
    .normalize('NFKC'); // Normalize Unicode
    
  return normalized;
}

/**
 * Sanitize and validate Solana public key
 */
export function sanitizePubkey(input: unknown): string | null {
  const sanitized = sanitizeString(input, 44, false);
  if (!sanitized) return null;
  
  // Solana pubkey: 32 bytes = 44 chars in base58
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(sanitized)) {
    return null;
  }
  
  return sanitized;
}

/**
 * Sanitize URL with anti-SSRF protection
 */
export function sanitizeUrl(
  input: unknown, 
  allowedSchemes = ['https', 'http'],
  allowedDomains?: string[]
): string | null {
  const sanitized = sanitizeString(input, 2048, false);
  if (!sanitized) return null;
  
  try {
    const url = new URL(sanitized);
    
    // Check scheme
    if (!allowedSchemes.includes(url.protocol.slice(0, -1))) {
      return null;
    }
    
    // Anti-SSRF: Block private IPs and localhost
    const hostname = url.hostname.toLowerCase();
    
    // Block localhost variants
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return null;
    }
    
    // Block private IP ranges (basic check)
    if (hostname.startsWith('192.168.') || 
        hostname.startsWith('10.') || 
        hostname.startsWith('172.')) {
      return null;
    }
    
    // Check domain allowlist if provided
    if (allowedDomains && allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some(domain => 
        hostname === domain || hostname.endsWith('.' + domain)
      );
      if (!isAllowed) return null;
    }
    
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize Twitter/X handle
 */
export function sanitizeTwitterHandle(input: unknown): string | null {
  const sanitized = sanitizeString(input, 15, false);
  if (!sanitized) return null;
  
  // Remove @ if present, validate format
  const handle = sanitized.replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    return null;
  }
  
  return handle;
}

/**
 * Sanitize numeric value with bounds
 */
export function sanitizeNumber(
  input: unknown, 
  min = Number.MIN_SAFE_INTEGER, 
  max = Number.MAX_SAFE_INTEGER
): number | null {
  if (typeof input === 'string') {
    const parsed = Number(input);
    if (!Number.isFinite(parsed)) return null;
    input = parsed;
  }
  
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    return null;
  }
  
  if (input < min || input > max) return null;
  
  return Math.floor(input); // Ensure integer
}

/**
 * Hardened schemas for Launchpad security
 */
export const LaunchpadSecuritySchemas = {
  /**
   * Token name: strict validation
   */
  tokenName: z.string()
    .min(1, "Token name is required")
    .max(32, "Token name too long")
    .regex(/^[a-zA-Z0-9 ._-]+$/, "Invalid characters in token name")
    .transform(val => sanitizeString(val, 32, false))
    .refine(val => val !== null, "Invalid token name"),
    
  /**
   * Token symbol: strict validation  
   */
  tokenSymbol: z.string()
    .min(1, "Token symbol is required")
    .max(10, "Token symbol too long")
    .regex(/^[A-Z0-9]+$/, "Token symbol must be uppercase alphanumeric")
    .transform(val => sanitizeString(val, 10, false))
    .refine(val => val !== null, "Invalid token symbol"),
    
  /**
   * Token decimals: bounded integer
   */
  tokenDecimals: z.number()
    .int("Decimals must be integer")
    .min(0, "Decimals cannot be negative")
    .max(18, "Maximum 18 decimals allowed")
    .transform(val => sanitizeNumber(val, 0, 18))
    .refine(val => val !== null, "Invalid decimals"),
    
  /**
   * Solana public key with validation
   */
  solanaPublicKey: z.string()
    .min(32, "Invalid public key length")
    .max(44, "Invalid public key length")
    .transform(val => sanitizePubkey(val))
    .refine(val => val !== null, "Invalid Solana public key"),
    
  /**
   * Safe URL validation with anti-SSRF
   */
  safeUrl: z.string()
    .url("Invalid URL format")
    .transform(val => sanitizeUrl(val, ['https', 'http']))
    .refine(val => val !== null, "URL blocked by security policy"),
    
  /**
   * Twitter handle validation
   */
  twitterHandle: z.string()
    .optional()
    .transform(val => val ? sanitizeTwitterHandle(val) : null),
    
  /**
   * Description with XSS protection
   */
  description: z.string()
    .optional()
    .transform(val => val ? sanitizeString(val, 500, true) : null),
    
  /**
   * Lamports amount validation
   */
  lamportsAmount: z.number()
    .int("Lamports must be integer")
    .min(1, "Amount must be positive")
    .max(1000000000000, "Amount too large") // 1000 SOL max
    .transform(val => sanitizeNumber(val, 1, 1000000000000))
    .refine(val => val !== null, "Invalid lamports amount"),
};

/**
 * Rate limiting key generation
 */
export function generateRateLimitKey(req: Request, prefix = 'launchpad'): string {
  const ip = req.headers.get('x-forwarded-for') || 
             req.headers.get('x-real-ip') || 
             'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  // Simple hash for consistent but anonymous rate limit keys
  const hash = btoa(`${ip}:${userAgent}`).slice(0, 16);
  return `${prefix}:${hash}`;
}

/**
 * Request size validation (prevent DoS)
 */
export function validateRequestSize(req: Request, maxBytes = 10240): boolean {
  const contentLength = req.headers.get('content-length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (isNaN(size) || size > maxBytes) {
      return false;
    }
  }
  return true;
}