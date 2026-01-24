# Launchpad Security Model

## Overview

The Launchpad security system implements multiple layers of protection to ensure safe token launch operations without impacting existing scan/simulate functionality. The system follows a defense-in-depth approach with fail-safe defaults.

## Security Principles

### 1. Isolation
- **No Impact on Existing Routes**: All new security code is isolated in `lib/security/*` and `lib/launchpad/*`
- **Feature Flag Control**: `LAUNCHPAD_ENABLED=false` by default, ensuring fail-safe operation
- **Separate Namespaces**: New routes under `/api/launchpad/*` don't affect existing `/api/scan`, `/api/simulate`, `/api/apply`

### 2. Defense in Depth
- **Input Validation**: Multi-layer validation (format, size, content, business rules)
- **SSRF Protection**: Comprehensive URL validation blocking private networks and dangerous schemes
- **Rate Limiting**: Per-IP and per-wallet rate limiting with configurable thresholds
- **Attestation Security**: Cryptographic signatures for all security assertions

### 3. Fail-Safe Defaults
- **Feature Flags**: All new features disabled by default
- **Strict Validation**: Reject invalid input rather than attempt correction
- **Conservative Limits**: Small size limits and short TTLs by default
- **Secure Schemes**: Only HTTPS allowed for external URLs

## Architecture Components

### Core Validation (`lib/security/validate.ts`)

#### Base58 Validators
```typescript
// Validate Solana addresses and signatures
Base58Validator.isValidMint(mint)        // 32 bytes = 44 chars
Base58Validator.isValidWallet(wallet)    // 32 bytes = 44 chars  
Base58Validator.isValidTxSignature(sig)  // 64 bytes = 88 chars
```

#### Size Limits
```typescript
SizeLimits.MAX_TOKEN_NAME = 32;      // characters
SizeLimits.MAX_TOKEN_SYMBOL = 10;    // characters
SizeLimits.MAX_DESCRIPTION = 500;    // characters
SizeLimits.MAX_URL = 2048;           // characters
SizeLimits.MAX_REQUEST_BODY = 64KB;  // bytes
```

#### Safe URL Validation
```typescript
SafeUrlValidator.isValidUrl(url)     // Returns {valid, reason}
SafeUrlValidator.validateAndNormalize(url)  // Normalizes valid URLs
```

### SSRF Protection (`lib/security/ssrf.ts`)

#### Blocked Resources
- **Private IP Ranges**: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
- **Localhost**: 127.0.0.1, localhost, ::1
- **Metadata Services**: 169.254.169.254 (AWS/GCP metadata)
- **Dangerous Schemes**: file://, data://, ftp://

#### Configuration
```typescript
const config: SSRFConfig = {
  allowedSchemes: ['https'],          // Only HTTPS
  allowPrivateIPs: false,             // Block private networks
  allowIPAddresses: false,            // Require domain names
  maxUrlLength: 2048,                 // URL size limit
  allowedPorts: null,                 // All HTTPS ports
};
```

### TTL Cache System (`lib/security/cache.ts`)

#### In-Memory Cache
```typescript
// Specialized caches for different use cases
attestationCache    // 5 minutes TTL, 500 entries
validationCache     // 10 minutes TTL, 1000 entries  
rateLimitCache     // 1 minute TTL, 10000 entries
```

#### LocalStorage Interface
```typescript
// Frontend-safe localStorage with TTL
const storage = new LocalStorageInterface('launchpad_');
storage.setItem('key', value, ttlMs);
storage.getItem('key');  // Returns null if expired
```

## Security Boundaries

### Input Validation Pipeline

1. **Size Check**: Reject oversized requests (64KB limit)
2. **Format Validation**: JSON parsing with error handling
3. **Schema Validation**: Zod schemas with strict type checking
4. **Content Sanitization**: Remove dangerous characters and normalize Unicode
5. **Business Logic**: Domain-specific validation rules
6. **SSRF Protection**: URL validation for external resources

### Rate Limiting Strategy

```typescript
// Rate limit keys combine multiple factors
const key = `${endpoint}:${ip}:${wallet}:${timeWindow}`;

// Limits by category
const limits = {
  submit: { requests: 10, window: 60000 },    // 10/minute
  verify: { requests: 100, window: 60000 },   // 100/minute  
  status: { requests: 1000, window: 60000 },  // 1000/minute
};
```

### Attestation Security

#### Signed Attestations
All security assertions are cryptographically signed:

```typescript
interface Attestation {
  mint: string;
  creatorWallet: string;
  badges: Badge[];
  shieldScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  reasons: string[];
  snapshot: {
    chain: string;
    rpc: string;
    slot: number;
    blockTime: number;
  };
  issuedAt: number;
  expiresAt: number;
  signature: string;  // HMAC or Ed25519
}
```

#### Verification Process
1. **Signature Verification**: Validate cryptographic signature
2. **Expiration Check**: Ensure attestation is not expired
3. **Revocation Check**: Verify attestation hasn't been revoked
4. **Content Validation**: Validate all attestation fields

## Threat Model

### Threats Mitigated

#### Server-Side Request Forgery (SSRF)
- **Attack**: Malicious URLs targeting internal services
- **Mitigation**: Comprehensive URL validation blocking private networks
- **Detection**: Failed SSRF attempts logged with request details

#### Injection Attacks
- **Attack**: SQL injection, NoSQL injection, command injection
- **Mitigation**: Parameterized queries, input sanitization, safe APIs
- **Detection**: Suspicious input patterns logged and blocked

#### Denial of Service (DoS)
- **Attack**: Resource exhaustion via large payloads or high frequency requests
- **Mitigation**: Size limits, rate limiting, TTL caches
- **Detection**: Rate limit violations and oversized requests logged

#### Data Tampering
- **Attack**: Modification of attestations or security assertions
- **Mitigation**: Cryptographic signatures, immutable attestations
- **Detection**: Signature verification failures logged

### Threats Acknowledged but Not Fully Mitigated

#### Distributed Denial of Service (DDoS)
- **Limitation**: Application-level rate limiting insufficient against large-scale DDoS
- **Recommendation**: Use CDN/proxy with DDoS protection (Cloudflare, AWS Shield)

#### Advanced Persistent Threats (APT)
- **Limitation**: Cannot prevent compromised signing keys or insider threats
- **Recommendation**: Key rotation, access controls, audit logging

#### Zero-Day Vulnerabilities
- **Limitation**: Cannot prevent unknown vulnerabilities in dependencies
- **Recommendation**: Regular security updates, dependency scanning

## Configuration

### Environment Variables

```bash
# Feature Control
LAUNCHPAD_ENABLED=false              # Master switch (fail-closed)

# Security Configuration  
ATTESTATION_SECRET=<secret>          # HMAC signing key
ATTESTATION_TTL_SECONDS=300          # 5 minutes default
WEBHOOKS_ENABLED=false               # Webhook processing
SSRF_ALLOW_PRIVATE_IPS=false         # Private IP access
SSRF_ALLOW_IP_ADDRESSES=false        # Direct IP access

# Rate Limiting
RATE_LIMIT_WINDOW=60000              # 1 minute windows
RATE_LIMIT_MAX_REQUESTS=100          # Default request limit
RATE_LIMIT_REDIS_URL=<url>           # Redis for distributed rate limiting

# Cache Configuration
CACHE_TTL_VALIDATION=600             # 10 minutes
CACHE_TTL_ATTESTATION=300            # 5 minutes  
CACHE_MAX_SIZE=1000                  # Max cache entries
```

### Security Headers

All Launchpad responses include security headers:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'none'
Referrer-Policy: no-referrer
X-Request-Id: <uuid>
Cache-Control: no-store, no-cache, must-revalidate
```

## Testing Strategy

### Security Testing

#### Input Validation Tests
```typescript
describe('Input Validation', () => {
  test('rejects oversized payloads', () => {
    const largePayload = 'x'.repeat(65536); // 64KB + 1
    expect(validator.validateSize(largePayload)).toBe(false);
  });
  
  test('blocks malicious URLs', () => {
    const maliciousUrls = [
      'http://localhost:8080/admin',
      'https://192.168.1.1/config',
      'file:///etc/passwd',
      'data:text/html,<script>alert(1)</script>',
    ];
    
    maliciousUrls.forEach(url => {
      expect(ssrfValidator.validateUrl(url).allowed).toBe(false);
    });
  });
});
```

#### SSRF Protection Tests
```typescript
describe('SSRF Protection', () => {
  test('blocks private IP ranges', () => {
    const privateIPs = [
      'https://192.168.1.1/',
      'https://10.0.0.1/',
      'https://172.16.0.1/',
      'https://127.0.0.1/',
    ];
    
    privateIPs.forEach(url => {
      expect(ssrfProtection.validateUrl(url).allowed).toBe(false);
    });
  });
  
  test('allows legitimate domains', () => {
    const legitimateUrls = [
      'https://example.com/',
      'https://cdn.jsdelivr.net/package@1.0.0/file.js',
      'https://api.github.com/repos/owner/repo',
    ];
    
    legitimateUrls.forEach(url => {
      expect(ssrfProtection.validateUrl(url).allowed).toBe(true);
    });
  });
});
```

#### Rate Limiting Tests
```typescript
describe('Rate Limiting', () => {
  test('enforces per-IP limits', async () => {
    const ip = '203.0.113.1';
    const endpoint = '/api/launchpad/submit';
    
    // Should allow requests within limit
    for (let i = 0; i < 10; i++) {
      expect(await rateLimit.check(ip, endpoint)).toBe(true);
    }
    
    // Should block requests over limit
    expect(await rateLimit.check(ip, endpoint)).toBe(false);
  });
});
```

### Integration Testing

#### End-to-End Security Tests
```bash
# Test feature flag enforcement
curl -X POST /api/launchpad/submit \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}' \
  # Should return 501 when LAUNCHPAD_ENABLED=false

# Test SSRF protection
curl -X POST /api/launchpad/submit \
  -H "Content-Type: application/json" \
  -d '{"metadataUri": "http://localhost:8080/admin"}' \
  # Should return 400 with SSRF protection error

# Test rate limiting
for i in {1..15}; do
  curl -X POST /api/launchpad/submit \
    -H "Content-Type: application/json" \
    -d '{"test": "data"}'
done
# Should start returning 429 after limit reached
```

## Monitoring and Alerting

### Security Metrics
- **SSRF Attempts**: Count of blocked malicious URLs
- **Rate Limit Violations**: Frequency and sources of rate limiting
- **Input Validation Failures**: Types and frequency of invalid inputs
- **Attestation Verification Failures**: Failed signature verifications

### Alert Conditions
- **High SSRF Attempt Rate**: >10 attempts/minute from single IP
- **Repeated Rate Limit Violations**: Same IP hitting limits across multiple endpoints
- **Attestation Tampering**: Multiple signature verification failures
- **Unusual Request Patterns**: Deviation from normal usage patterns

### Logging Format
```json
{
  "timestamp": "2024-01-24T10:30:00Z",
  "level": "WARN",
  "event": "ssrf_blocked",
  "requestId": "req_abc123",
  "ip": "203.0.113.1",
  "url": "http://localhost:8080/admin",
  "reason": "Private IP addresses not allowed",
  "endpoint": "/api/launchpad/submit"
}
```

## Compliance and Auditing

### Security Audit Trail
All security-relevant events are logged with sufficient detail for forensic analysis:

- **Authentication Events**: Login attempts, session creation/destruction
- **Authorization Events**: Access granted/denied with reasons
- **Input Validation Events**: Failed validations with sanitized input details
- **SSRF Protection Events**: Blocked URLs and reasons
- **Rate Limiting Events**: Limit violations and enforcement actions

### Data Retention
- **Security Logs**: 90 days retention minimum
- **Audit Trails**: 1 year retention for compliance
- **Attestations**: Permanent retention with archival after 1 year
- **Cache Data**: TTL-based automatic expiration

---

**Document Version**: PR-A Foundation  
**Last Updated**: 2024-01-24  
**Next Review**: After each PR implementation