/**
 * Tests for validation utilities
 */

import { Base58Validator, SizeLimits, SafeUrlValidator, InputSanitizer, LaunchpadValidator } from '../validate';

describe('Base58Validator', () => {
  describe('isValidBase58', () => {
    test('accepts valid base58 strings', () => {
      expect(Base58Validator.isValidBase58('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz')).toBe(true);
      expect(Base58Validator.isValidBase58('5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ')).toBe(true);
    });

    test('rejects invalid characters', () => {
      expect(Base58Validator.isValidBase58('0OIl')).toBe(false); // Invalid chars
      expect(Base58Validator.isValidBase58('test@example.com')).toBe(false);
      expect(Base58Validator.isValidBase58('')).toBe(false);
      expect(Base58Validator.isValidBase58(null as any)).toBe(false);
    });
  });

  describe('isValidMint', () => {
    test('accepts valid mint addresses', () => {
      expect(Base58Validator.isValidMint('11111111111111111111111111111112')).toBe(true);
      expect(Base58Validator.isValidMint('So11111111111111111111111111111111111111112')).toBe(true);
    });

    test('rejects invalid mint addresses', () => {
      expect(Base58Validator.isValidMint('short')).toBe(false);
      expect(Base58Validator.isValidMint('this-is-way-too-long-to-be-a-valid-solana-mint-address-definitely')).toBe(false);
      expect(Base58Validator.isValidMint('')).toBe(false);
    });
  });

  describe('isValidWallet', () => {
    test('accepts valid wallet addresses', () => {
      expect(Base58Validator.isValidWallet('11111111111111111111111111111112')).toBe(true);
      expect(Base58Validator.isValidWallet('So11111111111111111111111111111111111111112')).toBe(true);
    });

    test('rejects invalid wallet addresses', () => {
      expect(Base58Validator.isValidWallet('invalid')).toBe(false);
      expect(Base58Validator.isValidWallet('')).toBe(false);
    });
  });

  describe('isValidTxSignature', () => {
    test('accepts valid transaction signatures', () => {
      const validSig = 'test'.repeat(22); // ~88 chars
      expect(Base58Validator.isValidTxSignature(validSig)).toBe(true);
    });

    test('rejects invalid signatures', () => {
      expect(Base58Validator.isValidTxSignature('short')).toBe(false);
      expect(Base58Validator.isValidTxSignature('')).toBe(false);
    });
  });
});

describe('SizeLimits', () => {
  describe('isValidStringLength', () => {
    test('accepts strings within limits', () => {
      expect(SizeLimits.isValidStringLength('hello', 10)).toBe(true);
      expect(SizeLimits.isValidStringLength('', 10)).toBe(true);
    });

    test('rejects strings exceeding limits', () => {
      expect(SizeLimits.isValidStringLength('hello world', 5)).toBe(false);
      expect(SizeLimits.isValidStringLength('test', 0)).toBe(false);
    });

    test('rejects non-strings', () => {
      expect(SizeLimits.isValidStringLength(123 as any, 10)).toBe(false);
      expect(SizeLimits.isValidStringLength(null as any, 10)).toBe(false);
    });
  });

  describe('isValidBodySize', () => {
    test('accepts valid body sizes', () => {
      expect(SizeLimits.isValidBodySize(1024)).toBe(true);
      expect(SizeLimits.isValidBodySize(0)).toBe(true);
      expect(SizeLimits.isValidBodySize(SizeLimits.MAX_REQUEST_BODY)).toBe(true);
    });

    test('rejects invalid body sizes', () => {
      expect(SizeLimits.isValidBodySize(-1)).toBe(false);
      expect(SizeLimits.isValidBodySize(SizeLimits.MAX_REQUEST_BODY + 1)).toBe(false);
    });
  });

  describe('isValidTokenName', () => {
    test('accepts valid token names', () => {
      expect(SizeLimits.isValidTokenName('Bitcoin')).toBe(true);
      expect(SizeLimits.isValidTokenName('My Token 2.0')).toBe(true);
      expect(SizeLimits.isValidTokenName('Test_Token-v1')).toBe(true);
    });

    test('rejects invalid token names', () => {
      expect(SizeLimits.isValidTokenName('')).toBe(false);
      expect(SizeLimits.isValidTokenName('   ')).toBe(false);
      expect(SizeLimits.isValidTokenName('Token@#$')).toBe(false);
      expect(SizeLimits.isValidTokenName('a'.repeat(100))).toBe(false);
    });
  });

  describe('isValidTokenSymbol', () => {
    test('accepts valid token symbols', () => {
      expect(SizeLimits.isValidTokenSymbol('BTC')).toBe(true);
      expect(SizeLimits.isValidTokenSymbol('USDC')).toBe(true);
      expect(SizeLimits.isValidTokenSymbol('TEST123')).toBe(true);
    });

    test('rejects invalid token symbols', () => {
      expect(SizeLimits.isValidTokenSymbol('btc')).toBe(false); // lowercase
      expect(SizeLimits.isValidTokenSymbol('TEST@')).toBe(false); // special chars
      expect(SizeLimits.isValidTokenSymbol('')).toBe(false);
      expect(SizeLimits.isValidTokenSymbol('TOOLONGSYMBOL')).toBe(false);
    });
  });
});

describe('SafeUrlValidator', () => {
  describe('isValidUrl', () => {
    test('accepts valid HTTPS URLs', () => {
      const result = SafeUrlValidator.isValidUrl('https://example.com');
      expect(result.valid).toBe(true);
    });

    test('rejects HTTP URLs', () => {
      const result = SafeUrlValidator.isValidUrl('http://example.com');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('HTTPS');
    });

    test('rejects localhost URLs', () => {
      const result = SafeUrlValidator.isValidUrl('https://localhost:3000');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('localhost');
    });

    test('rejects private IP ranges', () => {
      const privateIPs = [
        'https://192.168.1.1',
        'https://10.0.0.1',
        'https://172.16.0.1',
        'https://127.0.0.1',
      ];

      privateIPs.forEach(url => {
        const result = SafeUrlValidator.isValidUrl(url);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Private IP');
      });
    });

    test('rejects file and data URLs', () => {
      const dangerousUrls = [
        'file:///etc/passwd',
        'data:text/html,<script>alert(1)</script>',
      ];

      dangerousUrls.forEach(url => {
        const result = SafeUrlValidator.isValidUrl(url);
        expect(result.valid).toBe(false);
      });
    });

    test('rejects direct IP addresses', () => {
      const result = SafeUrlValidator.isValidUrl('https://8.8.8.8');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('IP addresses not allowed');
    });

    test('rejects URLs that are too long', () => {
      const longUrl = 'https://example.com/' + 'x'.repeat(3000);
      const result = SafeUrlValidator.isValidUrl(longUrl);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('too long');
    });
  });

  describe('validateAndNormalize', () => {
    test('normalizes valid URLs', () => {
      const result = SafeUrlValidator.validateAndNormalize('https://example.com/path?b=2&a=1#fragment');
      expect(result.url).toBeDefined();
      expect(result.url).not.toContain('#fragment');
      expect(result.error).toBeUndefined();
    });

    test('returns error for invalid URLs', () => {
      const result = SafeUrlValidator.validateAndNormalize('https://localhost');
      expect(result.url).toBeNull();
      expect(result.error).toBeDefined();
    });
  });
});

describe('InputSanitizer', () => {
  describe('sanitizeString', () => {
    test('trims and validates strings', () => {
      expect(InputSanitizer.sanitizeString('  hello  ', 10)).toBe('hello');
      expect(InputSanitizer.sanitizeString('test', 10)).toBe('test');
    });

    test('rejects non-strings', () => {
      expect(InputSanitizer.sanitizeString(123, 10)).toBeNull();
      expect(InputSanitizer.sanitizeString(null, 10)).toBeNull();
    });

    test('rejects strings that are too long', () => {
      expect(InputSanitizer.sanitizeString('hello world', 5)).toBeNull();
    });

    test('rejects empty strings', () => {
      expect(InputSanitizer.sanitizeString('', 10)).toBeNull();
      expect(InputSanitizer.sanitizeString('   ', 10)).toBeNull();
    });

    test('removes control characters', () => {
      const result = InputSanitizer.sanitizeString('hello\x00\x08world', 20);
      expect(result).toBe('helloworld');
    });
  });

  describe('sanitizeNumber', () => {
    test('accepts valid numbers', () => {
      expect(InputSanitizer.sanitizeNumber(42)).toBe(42);
      expect(InputSanitizer.sanitizeNumber('42')).toBe(42);
      expect(InputSanitizer.sanitizeNumber(42.7)).toBe(42); // floors
    });

    test('rejects invalid numbers', () => {
      expect(InputSanitizer.sanitizeNumber('not a number')).toBeNull();
      expect(InputSanitizer.sanitizeNumber(Infinity)).toBeNull();
      expect(InputSanitizer.sanitizeNumber(NaN)).toBeNull();
    });

    test('respects min/max bounds', () => {
      expect(InputSanitizer.sanitizeNumber(5, 0, 10)).toBe(5);
      expect(InputSanitizer.sanitizeNumber(-1, 0, 10)).toBeNull();
      expect(InputSanitizer.sanitizeNumber(15, 0, 10)).toBeNull();
    });
  });
});

describe('LaunchpadValidator', () => {
  describe('validateMint', () => {
    test('validates correct mint addresses', () => {
      const result = LaunchpadValidator.validateMint('11111111111111111111111111111112');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('11111111111111111111111111111112');
    });

    test('rejects invalid mint addresses', () => {
      const result = LaunchpadValidator.validateMint('invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateWallet', () => {
    test('validates correct wallet addresses', () => {
      const result = LaunchpadValidator.validateWallet('So11111111111111111111111111111111111111112');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBeDefined();
    });

    test('rejects invalid wallet addresses', () => {
      const result = LaunchpadValidator.validateWallet('invalid-wallet');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateMetadataUri', () => {
    test('validates and normalizes valid HTTPS URLs', () => {
      const result = LaunchpadValidator.validateMetadataUri('https://example.com/metadata.json');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBeDefined();
    });

    test('rejects invalid URLs', () => {
      const result = LaunchpadValidator.validateMetadataUri('http://localhost/metadata.json');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});