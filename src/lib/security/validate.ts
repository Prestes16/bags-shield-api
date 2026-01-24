/**
 * Security validation utilities for Launchpad
 * Isolated validators that do not impact existing scan/simulate flows
 */

/**
 * Base58 validation for Solana addresses and signatures
 */
export class Base58Validator {
  private static readonly BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  
  /**
   * Validate if string is valid base58
   */
  static isValidBase58(input: string): boolean {
    if (!input || typeof input !== 'string') return false;
    
    // Check all characters are in base58 alphabet
    for (let i = 0; i < input.length; i++) {
      if (!this.BASE58_ALPHABET.includes(input[i])) {
        return false;
      }
    }
    return true;
  }

  /**
   * Validate Solana mint address (32 bytes = 44 chars in base58)
   */
  static isValidMint(mint: string): boolean {
    if (!mint || typeof mint !== 'string') return false;
    if (mint.length < 32 || mint.length > 44) return false;
    return this.isValidBase58(mint);
  }

  /**
   * Validate Solana wallet address (32 bytes = 44 chars in base58)
   */
  static isValidWallet(wallet: string): boolean {
    if (!wallet || typeof wallet !== 'string') return false;
    if (wallet.length < 32 || wallet.length > 44) return false;
    return this.isValidBase58(wallet);
  }

  /**
   * Validate Solana transaction signature (64 bytes = 88 chars in base58)
   */
  static isValidTxSignature(signature: string): boolean {
    if (!signature || typeof signature !== 'string') return false;
    if (signature.length < 86 || signature.length > 90) return false;
    return this.isValidBase58(signature);
  }
}

/**
 * Size limit validators
 */
export class SizeLimits {
  // String size limits (characters)
  static readonly MAX_TOKEN_NAME = 32;
  static readonly MAX_TOKEN_SYMBOL = 10;
  static readonly MAX_DESCRIPTION = 500;
  static readonly MAX_URL = 2048;
  static readonly MAX_HANDLE = 32;
  
  // Body size limits (bytes)
  static readonly MAX_REQUEST_BODY = 64 * 1024; // 64KB
  static readonly MAX_JSON_DEPTH = 10;
  static readonly MAX_ARRAY_LENGTH = 100;

  /**
   * Validate string length within limits
   */
  static isValidStringLength(input: string, maxLength: number): boolean {
    if (typeof input !== 'string') return false;
    return input.length <= maxLength;
  }

  /**
   * Validate request body size
   */
  static isValidBodySize(bodySize: number): boolean {
    return bodySize >= 0 && bodySize <= this.MAX_REQUEST_BODY;
  }

  /**
   * Validate token name
   */
  static isValidTokenName(name: string): boolean {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > this.MAX_TOKEN_NAME) return false;
    
    // Only alphanumeric, spaces, dots, underscores, hyphens
    return /^[a-zA-Z0-9 ._-]+$/.test(trimmed);
  }

  /**
   * Validate token symbol
   */
  static isValidTokenSymbol(symbol: string): boolean {
    if (!symbol || typeof symbol !== 'string') return false;
    const trimmed = symbol.trim();
    if (trimmed.length === 0 || trimmed.length > this.MAX_TOKEN_SYMBOL) return false;
    
    // Only uppercase alphanumeric
    return /^[A-Z0-9]+$/.test(trimmed);
  }
}

/**
 * Safe URL validator with security constraints
 */
export class SafeUrlValidator {
  private static readonly ALLOWED_SCHEMES = ['https'];
  private static readonly BLOCKED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0',
  ];
  
  private static readonly PRIVATE_IP_PATTERNS = [
    /^192\.168\./,      // 192.168.0.0/16
    /^10\./,            // 10.0.0.0/8
    /^172\.(1[6-9]|2\d|3[01])\./,  // 172.16.0.0/12
    /^169\.254\./,      // 169.254.0.0/16 (link-local)
    /^fc00:/i,          // fc00::/7 (IPv6 unique local)
    /^fe80:/i,          // fe80::/10 (IPv6 link-local)
  ];

  /**
   * Validate URL with security constraints
   */
  static isValidUrl(input: string): { valid: boolean; reason?: string } {
    if (!input || typeof input !== 'string') {
      return { valid: false, reason: 'Invalid input type' };
    }

    if (input.length > SizeLimits.MAX_URL) {
      return { valid: false, reason: 'URL too long' };
    }

    let url: URL;
    try {
      url = new URL(input);
    } catch {
      return { valid: false, reason: 'Invalid URL format' };
    }

    // Only HTTPS allowed
    if (!this.ALLOWED_SCHEMES.includes(url.protocol.slice(0, -1))) {
      return { valid: false, reason: 'Only HTTPS URLs allowed' };
    }

    // Block file:// and data:// schemes
    if (url.protocol === 'file:' || url.protocol === 'data:') {
      return { valid: false, reason: 'File and data URLs blocked' };
    }

    const hostname = url.hostname.toLowerCase();

    // Block localhost variants
    if (this.BLOCKED_HOSTS.includes(hostname)) {
      return { valid: false, reason: 'Localhost URLs blocked' };
    }

    // Block private IP ranges
    for (const pattern of this.PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, reason: 'Private IP ranges blocked' };
      }
    }

    // Block IP addresses entirely (basic check)
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || /^[0-9a-f:]+$/i.test(hostname)) {
      return { valid: false, reason: 'IP addresses not allowed, use domain names' };
    }

    return { valid: true };
  }

  /**
   * Validate and normalize URL
   */
  static validateAndNormalize(input: string): { url: string | null; error?: string } {
    const validation = this.isValidUrl(input);
    
    if (!validation.valid) {
      return { url: null, error: validation.reason };
    }

    try {
      const url = new URL(input);
      // Normalize: remove fragment, sort query params
      url.hash = '';
      const params = Array.from(url.searchParams.entries()).sort();
      url.search = '';
      params.forEach(([key, value]) => url.searchParams.append(key, value));
      
      return { url: url.toString() };
    } catch {
      return { url: null, error: 'URL normalization failed' };
    }
  }
}

/**
 * Input sanitization utilities
 */
export class InputSanitizer {
  /**
   * Sanitize string input
   */
  static sanitizeString(input: unknown, maxLength: number = 1000): string | null {
    if (typeof input !== 'string') return null;
    
    const trimmed = input.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > maxLength) return null;
    
    // Remove control characters and normalize Unicode
    const sanitized = trimmed
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
      .normalize('NFKC'); // Normalize Unicode
      
    return sanitized.length > 0 ? sanitized : null;
  }

  /**
   * Sanitize numeric input
   */
  static sanitizeNumber(
    input: unknown, 
    min: number = Number.MIN_SAFE_INTEGER, 
    max: number = Number.MAX_SAFE_INTEGER
  ): number | null {
    let num: number;
    
    if (typeof input === 'string') {
      num = Number(input);
    } else if (typeof input === 'number') {
      num = input;
    } else {
      return null;
    }
    
    if (!Number.isFinite(num) || num < min || num > max) {
      return null;
    }
    
    return Math.floor(num); // Ensure integer
  }
}

/**
 * Validation result types
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: any;
}

/**
 * Combined validator for common use cases
 */
export class LaunchpadValidator {
  /**
   * Validate ProofPack mint field
   */
  static validateMint(mint: unknown): ValidationResult {
    const sanitized = InputSanitizer.sanitizeString(mint, 44);
    
    if (!sanitized) {
      return { valid: false, error: 'Invalid mint format' };
    }
    
    if (!Base58Validator.isValidMint(sanitized)) {
      return { valid: false, error: 'Invalid mint address' };
    }
    
    return { valid: true, sanitized };
  }

  /**
   * Validate wallet address
   */
  static validateWallet(wallet: unknown): ValidationResult {
    const sanitized = InputSanitizer.sanitizeString(wallet, 44);
    
    if (!sanitized) {
      return { valid: false, error: 'Invalid wallet format' };
    }
    
    if (!Base58Validator.isValidWallet(sanitized)) {
      return { valid: false, error: 'Invalid wallet address' };
    }
    
    return { valid: true, sanitized };
  }

  /**
   * Validate metadata URI
   */
  static validateMetadataUri(uri: unknown): ValidationResult {
    const sanitized = InputSanitizer.sanitizeString(uri, SizeLimits.MAX_URL);
    
    if (!sanitized) {
      return { valid: false, error: 'Invalid URI format' };
    }
    
    const urlValidation = SafeUrlValidator.validateAndNormalize(sanitized);
    
    if (!urlValidation.url) {
      return { valid: false, error: urlValidation.error || 'Invalid URL' };
    }
    
    return { valid: true, sanitized: urlValidation.url };
  }
}