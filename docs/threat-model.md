# Threat model (high level)

## Primary threats
1) Forged scan results (client-crafted payloads)
2) Abuse / scraping / rate-limit bypass
3) SSRF via any URL ingestion (metadata/image URLs)
4) Replay of previously valid responses in new contexts
5) Data poisoning / upstream instability

## Mitigations
- Client is untrusted; server computes outcomes
- Strict schema validation (reject unknown keys)
- Rate limiting, timeouts, and request budgets
- Explicit degraded mode when upstream is unavailable
- Response integrity markers (hash + signature) for anti-forgery
- Sanitized logging + no-store caching