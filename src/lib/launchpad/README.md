# Launchpad Security Hardening Implementation

## 🎯 Overview

This directory contains the security-hardened implementation of the Bags Shield Launchpad feature. The implementation follows a PR-by-PR delivery approach, with each PR building upon the previous security foundation.

## 🔒 Security-First Design

### Core Principles
- **Fail-Closed**: All features disabled by default (`LAUNCHPAD_ENABLED=false`)
- **Input Sanitization**: All user inputs sanitized and validated
- **Defense in Depth**: Multiple layers of security checks
- **Audit Trail**: Comprehensive logging for security monitoring
- **Rate Limiting**: Protection against abuse and DoS
- **Anti-SSRF**: URL validation with private IP blocking

## 📦 PR Delivery Plan

### ✅ PR0: Security Foundation (COMPLETED)
**Status**: Implemented and tested
**Files Created**:
- `sanitization.ts` - Input sanitization utilities
- `security-schemas.ts` - Hardened validation schemas
- `feature-flags.ts` - Granular feature control
- `submit/route.ts` - Main submission endpoint (returns 501 when disabled)
- `status/route.ts` - Public status and feature discovery

**Security Features**:
- ✅ Feature flag enforcement (`LAUNCHPAD_ENABLED=false` by default)
- ✅ Input sanitization (XSS, injection prevention)
- ✅ Schema validation with Zod
- ✅ Request size validation (DoS prevention)
- ✅ Anti-SSRF URL validation
- ✅ Rate limit key generation
- ✅ Comprehensive error handling
- ✅ Audit logging

### 🔄 PR1: SIWS Authentication (PLANNED)
**Endpoint**: `/api/launchpad/auth/*`
**Features**:
- Sign-in with Solana (SIWS) message verification
- Ed25519 signature validation
- Short-lived JWT session tokens
- Session management and revocation
- Authentication middleware

### 🔄 PR2: ProofPack Schema (PLANNED) 
**Features**:
- ProofPack validation schema
- Mint address verification
- Deployer wallet validation
- Pool configuration validation
- Locker proof allowlist verification
- Metadata URI validation
- **No user-provided scores** (security requirement)

### 🔄 PR3: On-Chain Verification (PLANNED)
**Features**:
- On-chain data verification against Solana RPC
- Deterministic score engine
- Badge generation system
- Risk assessment with reasons
- Unknown status for non-provable tokens

### 🔄 PR4: Signed Attestation (PLANNED)
**Features**:
- Cryptographically signed attestations
- Blockchain snapshot capture (chain, RPC, blockSlot)
- Attestation signature verification
- Tamper-proof audit trail

### 🔄 PR5: Persistence Layer (PLANNED)
**Features**:
- KV store integration
- Rate limiting implementation
- Idempotency key system
- Data persistence with TTL
- Query optimization

### 🔄 PR6: Monitoring & Webhooks (PLANNED)
**Features**:
- Helius webhook integration
- Revocation status updates  
- Security monitoring
- Alert system
- Status change notifications

## 🔧 Configuration

### Environment Variables

```bash
# Feature Control (default: disabled for security)
LAUNCHPAD_ENABLED=false          # Main feature flag
LAUNCHPAD_MODE=stub              # Mode: stub|real

# Security Configuration
ALLOWED_IMAGE_DOMAINS=           # Comma-separated allowlist
CORS_ORIGINS=                    # CORS configuration
SOLANA_RPC_URL=                  # Solana RPC endpoint

# Future Configuration (PR1+)
LAUNCHPAD_JWT_SECRET=            # JWT signing secret (PR1)
LAUNCHPAD_KV_URL=               # KV store connection (PR5)
HELIUS_WEBHOOK_SECRET=          # Webhook verification (PR6)
```

### Feature Flags

The system uses granular feature flags for progressive rollout:

```typescript
interface LaunchpadFeatures {
  enabled: boolean;                    // Master switch
  auth: { siws: boolean; sessions: boolean; };          // PR1
  verification: { proofPack: boolean; onChain: boolean; scoring: boolean; }; // PR2-3
  attestation: { signing: boolean; snapshots: boolean; };                   // PR4
  storage: { persistence: boolean; rateLimit: boolean; idempotency: boolean; }; // PR5
  monitoring: { webhooks: boolean; alerts: boolean; };                     // PR6
}
```

## 🛡️ Security Architecture

### Input Validation Pipeline
1. **Request Size Check** - Prevent DoS attacks
2. **JSON Parsing** - Safe parsing with error handling  
3. **Schema Validation** - Zod schemas with sanitization
4. **Business Logic Validation** - Domain-specific checks
5. **Security Policy Enforcement** - Rate limits, IP blocks

### URL Security (Anti-SSRF)
- Private IP blocking (192.168.x.x, 10.x.x.x, 172.x.x.x)
- Localhost protection (127.0.0.1, localhost, ::1)
- Protocol allowlist (HTTPS/HTTP only)
- Domain allowlist support
- URL normalization

### Error Handling
- Standardized error response format
- Security-conscious error messages (no sensitive data leakage)
- Comprehensive request ID tracking
- Audit logging for security events

## 📊 API Response Format

All Launchpad endpoints use a standardized response format:

```typescript
interface LaunchpadResponse {
  success: boolean;
  response?: any;                    // Success data
  error?: {                         // Error information
    code: string;
    message: string;
    details?: any;
  };
  meta: {                          // Request metadata
    requestId: string;
    timestamp: string;
    endpoint?: string;
    rateLimit?: {
      limit: number;
      remaining: number;
      reset: number;
    };
  };
}
```

## 🧪 Testing

### Security Testing
- Input sanitization tests
- Schema validation tests
- Feature flag enforcement tests  
- Anti-SSRF protection tests
- Rate limiting tests
- Error handling tests

### Integration Testing
- End-to-end endpoint tests
- Authentication flow tests (PR1+)
- On-chain verification tests (PR3+)
- Webhook integration tests (PR6+)

## 📝 Usage Examples

### Check Status (Always Available)
```bash
curl https://app.com/api/launchpad/status
```

### Submit Token Launch (PR0: Returns 501 Not Implemented)
```bash
curl -X POST https://app.com/api/launchpad/submit \
  -H "Content-Type: application/json" \
  -d '{
    "token": {
      "name": "Test Token",
      "symbol": "TEST", 
      "decimals": 6
    },
    "launch": {
      "launchWallet": "11111111111111111111111111111112"
    }
  }'
```

## 🔍 Monitoring

### Key Metrics
- Request volume and error rates
- Feature flag usage
- Security violation attempts
- Response time percentiles
- Authentication success/failure rates (PR1+)

### Security Events
- Invalid input attempts
- Blocked URL submissions
- Rate limit violations
- Authentication failures (PR1+)
- Webhook failures (PR6+)

## 🚀 Deployment

### PR0 Deployment Checklist
- ✅ Environment variables configured
- ✅ Feature flags verified (LAUNCHPAD_ENABLED=false)
- ✅ Security headers enabled
- ✅ Rate limiting configured
- ✅ Logging and monitoring active
- ✅ Error handling tested

### Future PR Deployment
Each subsequent PR will include its own deployment checklist and rollback procedures.

---

**Security Contact**: For security issues, please report through the designated security channel.
**Documentation Version**: PR0-Foundation
**Last Updated**: 2026-01-24