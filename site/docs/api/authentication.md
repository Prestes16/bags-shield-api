---
title: Authentication
---

Authentication is designed to be simple: **API keys**, **rate limits**, and **requestId** tracing for support and audit.

## Headers

| Header | Required | Description |
|--------|----------|-------------|
| `x-api-key` | Yes | Your API key. Obtain from the dashboard or contact. |
| `x-request-id` | No | Unique ID for the request (UUID recommended). Used for tracing and support. |
| `Content-Type` | Yes (POST) | `application/json` for request bodies. |

## Rate limits

Requests are subject to rate limits per API key. When exceeded, the API returns `429 Too Many Requests`. Include `x-request-id` to help with limit-increase or debugging.

## Example

```bash
curl -X GET "https://api.bagsshield.org/v1/scan/token/So11111111111111111111111111111111111111112" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "x-request-id: 550e8400-e29b-41d4-a716-446655440000"
```

Responses include standard HTTP status codes. Use the same `x-request-id` in support requests for traceability.
