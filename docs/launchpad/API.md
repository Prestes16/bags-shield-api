# Launchpad API Documentation

## Overview

The Launchpad API provides secure endpoints for token creation and validation in the Bags Shield ecosystem. All endpoints follow strict security practices and return standardized responses.

## Base URL

- **Production**: `https://bags-shield-api.vercel.app`
- **Local Development**: `http://localhost:3000`

## Feature Flags

The Launchpad can be enabled/disabled and run in different modes:

- `LAUNCHPAD_ENABLED`: Enable/disable Launchpad feature (default: `false`)
- `LAUNCHPAD_MODE`: Operation mode - `stub` (default) or `real`
- `ALLOWED_IMAGE_DOMAINS`: Comma-separated list of allowed domains for image URLs (optional)

### Modes

- **stub**: Returns mock responses without calling Bags API. Useful for testing and development.
- **real**: Makes actual calls to Bags API. Requires `BAGS_API_KEY` and `BAGS_API_BASE` to be configured.

## Authentication

Currently, Launchpad endpoints do not require authentication. Rate limiting is applied per IP address.

## Rate Limiting

- **Default**: 20 requests per minute per IP
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Response**: 429 Too Many Requests when exceeded

## Security Headers

All responses include security headers:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (production only)

## Response Format

All endpoints follow a standardized response format:

### Success Response

```json
{
  "success": true,
  "response": {
    // Endpoint-specific data
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "upstream": "bags|stub",
    "upstreamStatus": 200,
    "elapsedMs": 123,
    "mode": "stub|real"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  },
  "issues": [
    {
      "path": "token.name",
      "message": "Field validation error"
    }
  ],
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## Endpoints

### POST /api/launchpad/token-info

Creates token metadata via Bags API (or stub).

**Request:**

```json
{
  "name": "My Awesome Token",
  "symbol": "MAT",
  "decimals": 9,
  "description": "A great token for testing",
  "imageUrl": "https://example.com/image.png",
  "websiteUrl": "https://example.com",
  "twitterHandle": "mytoken",
  "telegramHandle": "mytoken"
}
```

**Response (201):**

```json
{
  "success": true,
  "response": {
    "tokenMint": "So11111111111111111111111111111111111111112",
    "tokenMetadata": {
      "name": "My Awesome Token",
      "symbol": "MAT",
      "decimals": 9,
      "description": "A great token for testing",
      "image": "https://example.com/image.png",
      "website": "https://example.com",
      "twitter": "mytoken",
      "telegram": "mytoken"
    },
    "tokenLaunch": {
      "status": "stub",
      "message": "This is a stub response..."
    }
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "upstream": "stub",
    "upstreamStatus": 200,
    "elapsedMs": 45,
    "mode": "stub"
  }
}
```

**Validation Rules:**
- `name`: Required, 1-32 characters
- `symbol`: Required, 1-10 characters
- `decimals`: Required, 0-18
- `description`: Optional, max 500 characters
- `imageUrl`: Optional, must be HTTP/HTTPS, blocked: localhost, private IPs, file://
- `websiteUrl`: Optional, same validation as imageUrl
- `twitterHandle`: Optional, 1-15 alphanumeric + underscore
- `telegramHandle`: Optional, 5-32 alphanumeric + underscore

**Error Codes:**
- `FEATURE_DISABLED`: Launchpad not enabled
- `VALIDATION_FAILED`: Request validation failed
- `TOO_MANY_REQUESTS`: Rate limit exceeded
- `UPSTREAM_ERROR`: Bags API error (real mode)
- `INTERNAL_ERROR`: Server error

---

### POST /api/launchpad/create-config

Creates launch configuration via Bags API (or stub).

**Request:**

```json
{
  "launchWallet": "So11111111111111111111111111111111111111112",
  "tipWallet": "So11111111111111111111111111111111111111112",
  "tipLamports": 1000000,
  "token": {
    "name": "My Token",
    "symbol": "MAT",
    "decimals": 9
  }
}
```

**Response (201):**

```json
{
  "success": true,
  "response": {
    "configKey": "So11111111111111111111111111111111111111112",
    "tx": null
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "upstream": "stub",
    "upstreamStatus": 200,
    "elapsedMs": 67,
    "mode": "stub"
  }
}
```

**Validation Rules:**
- `launchWallet`: Required, valid Solana base58 address (32-44 chars)
- `tipWallet`: Optional, valid Solana base58 address
- `tipLamports`: Required if `tipWallet` provided, must be > 0
- `token`: Required, valid TokenDraft object

**Error Codes:**
- Same as `/token-info` plus:
- `IDEMPOTENCY_KEY_CONFLICT`: Request with same idempotency key already processed

---

### POST /api/launchpad/preflight

Validates launch configuration and returns preflight report.

**Request:**

```json
{
  "config": {
    "launchWallet": "So11111111111111111111111111111111111111112",
    "token": {
      "name": "My Token",
      "symbol": "MAT",
      "decimals": 9
    }
  }
}
```

**Response (200):**

```json
{
  "success": true,
  "response": {
    "isValid": true,
    "issues": [],
    "warnings": [
      {
        "path": "token.description",
        "message": "Description should be at least 10 characters"
      }
    ],
    "validatedAt": "2024-01-01T00:00:00.000Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "elapsedMs": 12,
    "mode": "stub"
  }
}
```

**Validation:**
- Validates entire `LaunchConfigDraft`
- Checks business rules (description length, HTTPS URLs, etc.)
- Returns structured issues and warnings

---

### POST /api/launchpad/manifest

Generates Shield Proof Manifest with HMAC signature.

**Request:**

```json
{
  "mint": "So11111111111111111111111111111111111111112",
  "shieldScore": 85,
  "grade": "A",
  "isSafe": true,
  "badges": [
    {
      "key": "validated",
      "title": "Token Validated",
      "severity": "low",
      "impact": "positive",
      "tags": ["validation", "security"]
    }
  ],
  "summary": "Token passed all security validations"
}
```

**Response (200):**

```json
{
  "success": true,
  "response": {
    "mint": "So11111111111111111111111111111111111111112",
    "shieldScore": 85,
    "grade": "A",
    "isSafe": true,
    "badges": [
      {
        "key": "validated",
        "title": "Token Validated",
        "severity": "low",
        "impact": "positive",
        "tags": ["validation", "security"]
      }
    ],
    "summary": "Token passed all security validations",
    "evaluatedAt": "2024-01-01T00:00:00.000Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "payloadHash": "sha256-hash-of-normalized-payload",
    "signature": "hmac-sha256-signature"
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "elapsedMs": 5
  }
}
```

**Features:**
- Normalizes payload (sorts badges and tags)
- Generates SHA-256 hash
- Signs with HMAC-SHA256 using `LAUNCHPAD_HMAC_SECRET`
- Hash is deterministic (same payload = same hash)

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `FEATURE_DISABLED` | 503 | Launchpad feature not enabled |
| `VALIDATION_FAILED` | 400 | Request validation failed |
| `BAD_REQUEST` | 400 | Invalid JSON or request format |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | Duplicate idempotency key |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Content-Type must be application/json |
| `UPSTREAM_ERROR` | 502 | Error from Bags API (real mode) |
| `INTERNAL_ERROR` | 500 | Internal server error |

## Security Features

### Anti-SSRF

URLs are validated to prevent SSRF attacks:
- Blocks `localhost`, `127.0.0.1`, `169.254.169.254`
- Blocks `file://` protocol
- Blocks private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
- Optional domain allowlist via `ALLOWED_IMAGE_DOMAINS`

### Rate Limiting

- In-memory rate limiting (best-effort for serverless)
- Per-IP and per-Idempotency-Key limits
- Headers indicate remaining requests and reset time

### Idempotency

- Optional `Idempotency-Key` header
- Prevents duplicate processing
- Returns 409 Conflict if key already used

### Logging

- Structured JSON logs
- Never logs secrets, env vars, or sensitive data
- Request ID for tracing
- Log levels: info, warn, error, debug

## Examples

### cURL

```bash
# Create token info
curl -X POST https://bags-shield-api.vercel.app/api/launchpad/token-info \
  -H "Content-Type: application/json" \
  -H "Cache-Control: no-store" \
  -d '{
    "name": "My Token",
    "symbol": "MAT",
    "decimals": 9
  }'

# Create launch config
curl -X POST https://bags-shield-api.vercel.app/api/launchpad/create-config \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-key-123" \
  -d '{
    "launchWallet": "So11111111111111111111111111111111111111112",
    "token": {
      "name": "My Token",
      "symbol": "MAT",
      "decimals": 9
    }
  }'
```

### JavaScript/TypeScript

```typescript
const response = await fetch("/api/launchpad/token-info", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
  body: JSON.stringify({
    name: "My Token",
    symbol: "MAT",
    decimals: 9,
  }),
});

const data = await response.json();
if (data.success) {
  console.log("Token mint:", data.response.tokenMint);
} else {
  console.error("Error:", data.error.message);
  console.error("Issues:", data.issues);
}
```

## Environment Variables

```bash
# Feature flags
LAUNCHPAD_ENABLED=true
LAUNCHPAD_MODE=stub  # or "real"

# Optional: Domain allowlist for image URLs
ALLOWED_IMAGE_DOMAINS=example.com,cdn.example.com

# Required for real mode
BAGS_API_BASE=https://public-api-v2.bags.fm/api/v1
BAGS_API_KEY=your-api-key

# Optional: HMAC secret for manifest signing
LAUNCHPAD_HMAC_SECRET=your-secret-key
```

## Stub Mode

When `LAUNCHPAD_MODE=stub`, endpoints return mock responses without calling Bags API:

- No dependency on Bags upstream
- Deterministic responses for testing
- Faster responses
- No API key required

Use stub mode for:
- Development and testing
- CI/CD pipelines
- Demos and presentations
- When Bags API is unavailable

## See Also

- [Architecture](./ARCHITECTURE.md) - System architecture
- [Threat Model](./THREAT_MODEL.md) - Security threats and mitigations
- [Testing](./TESTING.md) - Testing guide
