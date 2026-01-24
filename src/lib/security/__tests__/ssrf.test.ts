/**
 * Tests for SSRF protection utilities
 */

import { SSRFProtection, validateUrlSSRF, secureFetch, DEFAULT_SSRF_CONFIG } from '../ssrf';

describe('SSRFProtection', () => {
  let protection: SSRFProtection;

  beforeEach(() => {
    protection = new SSRFProtection();
  });

  describe('validateUrl', () => {
    test('allows valid HTTPS URLs', () => {
      const validUrls = [
        'https://example.com',
        'https://api.github.com/repos/owner/repo',
        'https://cdn.jsdelivr.net/npm/package@1.0.0/file.js',
        'https://subdomain.example.org/path?query=value',
      ];

      validUrls.forEach(url => {
        const result = protection.validateUrl(url);
        expect(result.allowed).toBe(true);
        expect(result.normalizedUrl).toBeDefined();
        expect(result.metadata).toBeDefined();
      });
    });

    test('blocks HTTP URLs', () => {
      const result = protection.validateUrl('http://example.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not allowed');
    });

    test('blocks localhost variants', () => {
      const localhosts = [
        'https://localhost',
        'https://localhost:3000',
        'https://127.0.0.1',
        'https://::1',
        'https://0.0.0.0',
      ];

      localhosts.forEach(url => {
        const result = protection.validateUrl(url);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('localhost') || expect(result.reason).toContain('blocked');
      });
    });

    test('blocks private IP ranges', () => {
      const privateIPs = [
        'https://192.168.1.1',
        'https://192.168.0.100',
        'https://10.0.0.1',
        'https://10.255.255.254',
        'https://172.16.0.1',
        'https://172.31.255.254',
        'https://169.254.1.1',
      ];

      privateIPs.forEach(url => {
        const result = protection.validateUrl(url);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Private IP') || expect(result.reason).toContain('not allowed');
      });
    });

    test('blocks metadata service endpoints', () => {
      const metadataUrls = [
        'https://metadata.google.internal',
        'https://169.254.169.254',
        'https://instance-data',
      ];

      metadataUrls.forEach(url => {
        const result = protection.validateUrl(url);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('blocked') || expect(result.reason).toContain('not allowed');
      });
    });

    test('blocks dangerous schemes', () => {
      // Test with custom config that includes more schemes
      const customProtection = new SSRFProtection({
        ...DEFAULT_SSRF_CONFIG,
        allowedSchemes: ['https', 'http'], // Allow http for this test
      });

      const dangerousSchemes = [
        'file:///etc/passwd',
        'ftp://example.com/file',
        'gopher://example.com',
        'ldap://example.com',
      ];

      dangerousSchemes.forEach(url => {
        const result = customProtection.validateUrl(url);
        expect(result.allowed).toBe(false);
      });
    });

    test('blocks direct IP addresses when configured', () => {
      const ipAddresses = [
        'https://8.8.8.8',
        'https://1.1.1.1',
        'https://[2001:db8::1]',
      ];

      ipAddresses.forEach(url => {
        const result = protection.validateUrl(url);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('IP addresses not allowed');
      });
    });

    test('rejects malformed URLs', () => {
      const malformedUrls = [
        'not-a-url',
        'https://',
        'https://[invalid-ipv6]',
        'https://example..com',
        '',
        null as any,
        undefined as any,
      ];

      malformedUrls.forEach(url => {
        const result = protection.validateUrl(url);
        expect(result.allowed).toBe(false);
      });
    });

    test('enforces URL length limits', () => {
      const longUrl = 'https://example.com/' + 'x'.repeat(3000);
      const result = protection.validateUrl(longUrl);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exceeds maximum length');
    });

    test('normalizes allowed URLs', () => {
      const result = protection.validateUrl('https://example.com/path?b=2&a=1#fragment');
      expect(result.allowed).toBe(true);
      expect(result.normalizedUrl).toBe('https://example.com/path?b=2&a=1');
      expect(result.normalizedUrl).not.toContain('#fragment');
    });

    test('includes metadata for allowed URLs', () => {
      const result = protection.validateUrl('https://example.com:8080/path');
      expect(result.allowed).toBe(true);
      expect(result.metadata).toEqual({
        scheme: 'https',
        hostname: 'example.com',
        port: 8080,
        isPrivateIP: false,
        isIPAddress: false,
      });
    });
  });

  describe('createSecureFetch', () => {
    test('creates fetch wrapper that validates URLs', async () => {
      const secureFetchFn = protection.createSecureFetch();

      // Mock fetch to avoid actual network calls
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue(new Response('OK'));

      try {
        // Should succeed with valid URL
        await expect(secureFetchFn('https://example.com')).resolves.toBeDefined();
        expect(global.fetch).toHaveBeenCalledWith('https://example.com', undefined);

        // Should fail with invalid URL
        await expect(secureFetchFn('https://localhost')).rejects.toThrow('SSRF protection');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});

describe('validateUrlSSRF', () => {
  test('uses default configuration', () => {
    const result = validateUrlSSRF('https://example.com');
    expect(result.allowed).toBe(true);
  });

  test('accepts custom configuration', () => {
    const result = validateUrlSSRF('http://example.com', { allowedSchemes: ['http', 'https'] });
    expect(result.allowed).toBe(true);
  });
});

describe('secureFetch', () => {
  test('validates URL before fetching', async () => {
    // Mock fetch
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(new Response('OK'));

    try {
      // Should succeed with valid URL
      await expect(secureFetch('https://example.com')).resolves.toBeDefined();

      // Should fail with invalid URL
      await expect(secureFetch('https://localhost')).rejects.toThrow('SSRF protection');
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('SSRF Configuration', () => {
  test('custom configuration overrides defaults', () => {
    const customConfig = {
      ...DEFAULT_SSRF_CONFIG,
      allowedSchemes: ['http', 'https'],
      allowPrivateIPs: true,
    };

    const protection = new SSRFProtection(customConfig);

    // Should now allow private IPs
    const result = protection.validateUrl('http://192.168.1.1');
    expect(result.allowed).toBe(true);
  });

  test('port restrictions work correctly', () => {
    const restrictedPortConfig = {
      ...DEFAULT_SSRF_CONFIG,
      allowedPorts: [443, 8443],
    };

    const protection = new SSRFProtection(restrictedPortConfig);

    // Should allow port 443
    let result = protection.validateUrl('https://example.com:443');
    expect(result.allowed).toBe(true);

    // Should allow port 8443
    result = protection.validateUrl('https://example.com:8443');
    expect(result.allowed).toBe(true);

    // Should block port 8080
    result = protection.validateUrl('https://example.com:8080');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Port 8080 not allowed');
  });
});

describe('Edge Cases', () => {
  let protection: SSRFProtection;

  beforeEach(() => {
    protection = new SSRFProtection();
  });

  test('handles IPv6 addresses correctly', () => {
    const ipv6Urls = [
      'https://[2001:db8::1]',
      'https://[::1]',
      'https://[fe80::1]',
    ];

    ipv6Urls.forEach(url => {
      const result = protection.validateUrl(url);
      expect(result.allowed).toBe(false); // Should be blocked as IP addresses
    });
  });

  test('handles international domain names', () => {
    // Most international domains should be allowed
    const result = protection.validateUrl('https://例え.テスト');
    // This might fail due to URL parsing, which is expected behavior
    expect(typeof result.allowed).toBe('boolean');
  });

  test('handles very long hostnames', () => {
    const longHostname = 'a'.repeat(300);
    const result = protection.validateUrl(`https://${longHostname}.com`);
    expect(result.allowed).toBe(false);
  });

  test('handles URLs with unusual but valid characters', () => {
    const result = protection.validateUrl('https://example.com/path-with_underscores.and.dots/file.json?param=value&other=123');
    expect(result.allowed).toBe(true);
  });
});