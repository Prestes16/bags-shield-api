# Bags Shield API - Usage Guide

## Base URLs

**Production:**
```
https://bags-shield-api.vercel.app
```

**Local Development:**
```
http://localhost:3000
http://127.0.0.1:8888  # dev-server.cjs default
```

---

## Response Envelope Contract

All API responses follow a consistent envelope format:

```json
{
  "success": true | false,
  "response": { /* payload data */ },
  "error": "string" | { "code": "string", "message": "string", "details": {} },
  "meta": {
    "requestId": "uuid-or-random-id",
    "upstream": "bags | internal | mock",
    "upstreamStatus": 200,
    "elapsedMs": 1234,
    "mode": "mock | prod | preview | dev"
  }
}
```

### Envelope Fields

- **`success`**: Boolean indicating overall request success
- **`response`**: Present when `success: true`, contains the actual data
- **`error`**: Present when `success: false`, contains error details (string or object)
- **`meta.requestId`**: Always present. Unique identifier for the request (for tracing/logging)
- **`meta.upstream`**: Optional. Source of data (`"bags"`, `"internal"`, `"mock"`)
- **`meta.upstreamStatus`**: Optional. HTTP status from upstream service
- **`meta.elapsedMs`**: Optional. Request processing time in milliseconds
- **`meta.mode`**: Optional. Operation mode (`"mock"`, `"prod"`, `"preview"`, `"dev"`)

---

## Headers

### Request Headers

- **`Content-Type`**: `application/json` (required for POST requests)
- **`X-Request-Id`**: Optional. If provided, will be used instead of generating a new one

### Response Headers

- **`X-Request-Id`**: Always present. Echoed from request or auto-generated UUID
- **`Cache-Control`**: Always `no-store` (prevents caching of responses)
- **`Access-Control-Allow-Origin`**: `*` (CORS enabled)
- **`Access-Control-Expose-Headers`**: `X-Request-Id`

---

## Endpoints

### Health Check

**`GET /api/health`**

Check API availability.

**Request:**
```bash
curl https://bags-shield-api.vercel.app/api/health
```

**Response (200):**
```json
{
  "success": true,
  "response": {
    "status": "ok"
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### Transaction Scan

**`POST /api/scan`**

Analyze a raw Solana transaction for security risks before broadcasting.

**Request:**
```bash
curl -X POST https://bags-shield-api.vercel.app/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "rawTransaction": "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "network": "solana-devnet"
  }'
```

**Request Body:**
```json
{
  "rawTransaction": "base64-encoded-transaction",
  "txBase64": "base64-encoded-transaction",  // alias for rawTransaction
  "network": "solana-devnet"  // optional, defaults to "solana-devnet"
}
```

**Response (200):**
```json
{
  "success": true,
  "response": {
    "network": "solana-devnet",
    "shieldScore": 80,
    "riskLevel": "B",
    "rawLength": 64,
    "badges": [
      {
        "id": "liquidity_locked",
        "label": "Liquidity Locked",
        "level": "LOW",
        "score": 92
      },
      {
        "id": "owner_renounced",
        "label": "Owner Renounced",
        "level": "LOW",
        "score": 88
      }
    ]
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "rawTransaction field is missing or invalid.",
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### Transaction Simulation

**`POST /api/simulate`**

Simulate the effects of a transaction and estimate risk/impact.

**Request:**
```bash
curl -X POST https://bags-shield-api.vercel.app/api/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "mint": "So11111111111111111111111111111111111111112"
  }'
```

**Request Body:**
```json
{
  "mint": "Base58-encoded-Solana-mint-address"
}
```

**Response (200):**
```json
{
  "success": true,
  "response": {
    "isSafe": false,
    "shieldScore": 68,
    "grade": "C",
    "warnings": [],
    "metadata": {
      "mode": "mock",
      "mintLength": 44,
      "base": null
    }
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "mode": "mock"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "mint field is missing or invalid."
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### Apply Decision

**`POST /api/apply`**

Apply decision rules based on scan/simulation results (block/allow/require confirmation).

**Request:**
```bash
curl -X POST https://bags-shield-api.vercel.app/api/apply \
  -H "Content-Type: application/json" \
  -d '{
    "action": "flag",
    "mint": "So11111111111111111111111111111111111111112"
  }'
```

**Response (200):**
```json
{
  "success": true,
  "response": {
    "applied": true
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### Create Token Info

**`POST /api/bags/token-info`**

Create token metadata via Bags API integration.

**Request:**
```bash
curl -X POST https://bags-shield-api.vercel.app/api/bags/token-info \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "name": "My Token",
    "symbol": "MTK",
    "description": "A test token",
    "imageUrl": "https://example.com/image.png",
    "telegram": "https://t.me/mytoken",
    "twitter": "https://twitter.com/mytoken",
    "website": "https://mytoken.com"
  }'
```

**Request Body:**
```json
{
  "name": "string (required, max 32 chars)",
  "symbol": "string (required, max 10 chars)",
  "description": "string (optional, max 1000 chars)",
  "imageUrl": "string (required if metadataUrl not provided, must be HTTPS)",
  "metadataUrl": "string (required if imageUrl not provided, must be HTTPS)",
  "telegram": "string (optional, HTTP/HTTPS URL, max 200 chars)",
  "twitter": "string (optional, HTTP/HTTPS URL, max 200 chars)",
  "website": "string (optional, HTTP/HTTPS URL, max 200 chars)"
}
```

**Response (200):**
```json
{
  "success": true,
  "response": {
    "tokenMint": "...",
    "tokenMetadata": {},
    "tokenLaunch": {}
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "upstream": "bags",
    "upstreamStatus": 200,
    "elapsedMs": 1234
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_NAME",
    "message": "Field 'name' is required and must be <= 32 characters."
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### Create Config

**`POST /api/bags/create-config`**

Create a token launch configuration via Bags API.

**Request:**
```bash
curl -X POST https://bags-shield-api.vercel.app/api/bags/create-config \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "launchWallet": "YourSolanaWalletPubkeyHere",
    "tipWallet": "OptionalTipWalletPubkey",
    "tipLamports": 1000000
  }'
```

**Request Body:**
```json
{
  "launchWallet": "string (required, Solana public key, 32-44 chars, base58)",
  "tipWallet": "string (optional, Solana public key, 32-44 chars, base58)",
  "tipLamports": "number (optional, non-negative integer, required if tipWallet provided)"
}
```

**Response (200):**
```json
{
  "success": true,
  "response": {
    "configKey": "BagsConfigPubkey",
    "tx": "Base64EncodedTransactionToSignOrNull"
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "upstream": "bags",
    "upstreamStatus": 200,
    "elapsedMs": 1234
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_LAUNCH_WALLET",
    "message": "Field 'launchWallet' must be a valid Solana public key."
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## Error Codes

Common error codes returned in the `error.code` field:

- `BAD_REQUEST` - Invalid request parameters
- `METHOD_NOT_ALLOWED` - HTTP method not allowed for endpoint
- `UNAUTHORIZED` - Authentication required
- `NOT_FOUND` - Resource not found
- `UNSUPPORTED_MEDIA_TYPE` - Content-Type not supported
- `PAYLOAD_TOO_LARGE` - Request body exceeds size limit
- `BAGS_NOT_CONFIGURED` - Bags API not configured
- `BAGS_FETCH_ERROR` - Error communicating with Bags API
- `UPSTREAM_ERROR` - Error from upstream service
- `INTERNAL_ERROR` - Internal server error

---

## Notes

- All timestamps are in ISO 8601 format
- All Solana addresses are base58-encoded strings
- All transaction data is base64-encoded
- The API uses `Cache-Control: no-store` to prevent stale data
- Request IDs are UUIDs or random strings, always present for tracing
- In mock mode, responses may contain placeholder data
