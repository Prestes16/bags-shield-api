# Bags Shield — Contrato de API v0

> Documento inicial (estático). Para exemplos reais, gere via script local.

## Headers obrigatórios
- `x-shield-api-version: v0`
- `x-shield-schema-version: v0`
- `Authorization: Bearer <token>` (se ativarmos proteção na rota)

## Envelope comum
```json
{ "success": true, "response": {}, "meta": { "requestId": "uuid", "version": "v0", "timestamp": "ISO-8601", "processingMs": 0 } }

