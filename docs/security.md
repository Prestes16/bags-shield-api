# Security (Transparency)

Bags Shield is designed as a risk intelligence layer. We prefer explicit degradation over silent failures.

## What we do today
- Schema-based validation and rejection of unknown keys where applicable
- Request size limits and content-type enforcement for API routes
- Rate limiting by IP (and optional keys when enabled)
- `Cache-Control: no-store` and requestId correlation for debugging
- Sanitized logging (secrets never logged)

## What we do not claim
We do not guarantee safety. Attackers evolve and risk is probabilistic.
Bags Shield helps users decide faster with better signals.

## Responsible disclosure
See [../SECURITY.md](../SECURITY.md).

## Future hardening (roadmap)
- Response integrity markers (hash/signature) to reduce forgery and replay risk
- Provenance metadata and stricter upstream verification
- Abuse-resistant caching and tighter per-route budgets