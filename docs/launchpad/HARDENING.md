# Launchpad Hardening Guide

## Overview

Este documento descreve as medidas de hardening implementadas na Launchpad para garantir segurança máxima.

## Feature Flags

### LAUNCHPAD_ENABLED

Controla se a Launchpad está habilitada.

- **Default**: `false` (desabilitado por padrão)
- **Valores**: `true`, `false`, `1`, `0`, `yes`, `no`, `on`, `off`
- **Comportamento**: Se desabilitado, todos os endpoints retornam `503 FEATURE_DISABLED`

### LAUNCHPAD_MODE

Controla o modo de operação.

- **Default**: `stub`
- **Valores**: `stub`, `real`
- **stub**: Retorna respostas mock sem chamar Bags API
- **real**: Faz chamadas reais para Bags API (requer `BAGS_API_KEY`)

## Domain Allowlist

### ALLOWED_IMAGE_DOMAINS

Lista de domínios permitidos para URLs de imagem (opcional).

- **Formato**: Comma-separated list (ex: `example.com,cdn.example.com`)
- **Comportamento**: 
  - Se não configurado: aceita qualquer domínio público válido
  - Se configurado: apenas domínios na lista são aceitos
- **Uso**: Restringe ainda mais a proteção anti-SSRF

**Exemplo**:
```bash
ALLOWED_IMAGE_DOMAINS=ipfs.io,arweave.net,example.com
```

## Security Headers

Todos os endpoints aplicam os seguintes headers de segurança:

- `X-Content-Type-Options: nosniff` - Previne MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` - Controla referrer
- `X-Frame-Options: DENY` - Previne clickjacking
- `Permissions-Policy` - Restringe features do browser
- `X-XSS-Protection: 1; mode=block` - Proteção XSS (legacy)
- `Strict-Transport-Security` - Force HTTPS (apenas produção)

## Logging Seguro

### SafeLogger

Sistema de logging estruturado que nunca loga dados sensíveis.

**Características**:
- Logs em JSON estruturado
- Detecta e redacta secrets automaticamente
- Nunca loga env vars (`process.env.*`)
- Nunca loga tokens, keys, passwords
- Stack traces apenas em desenvolvimento

**Níveis**:
- `info`: Operações normais
- `warn`: Avisos (ex: feature disabled)
- `error`: Erros com contexto sanitizado
- `debug`: Apenas em desenvolvimento

**Exemplo**:
```typescript
SafeLogger.info("Token created", {
  requestId: "123",
  endpoint: "/api/launchpad/token-info",
  elapsedMs: 45,
});

// Nunca loga:
// - process.env.BAGS_API_KEY
// - Tokens ou secrets
// - Dados sensíveis do request
```

## Modo Stub

O modo stub permite desenvolvimento e testes sem depender do Bags upstream.

**Características**:
- ✅ Não requer `BAGS_API_KEY`
- ✅ Não requer `BAGS_API_BASE`
- ✅ Respostas determinísticas
- ✅ Mais rápido (sem chamadas HTTP)
- ✅ Funciona offline

**Limitações**:
- Respostas são mockadas
- Não valida contra Bags real
- Mint addresses são gerados aleatoriamente

**Quando usar**:
- Desenvolvimento local
- Testes automatizados
- CI/CD pipelines
- Demos e apresentações
- Quando Bags API está indisponível

## Configuração Recomendada

### Desenvolvimento

```bash
LAUNCHPAD_ENABLED=true
LAUNCHPAD_MODE=stub
```

### Staging/Preview

```bash
LAUNCHPAD_ENABLED=true
LAUNCHPAD_MODE=stub
ALLOWED_IMAGE_DOMAINS=example.com,cdn.example.com
```

### Produção

```bash
LAUNCHPAD_ENABLED=true
LAUNCHPAD_MODE=real
BAGS_API_BASE=https://public-api-v2.bags.fm/api/v1
BAGS_API_KEY=your-secure-api-key
ALLOWED_IMAGE_DOMAINS=ipfs.io,arweave.net,your-cdn.com
LAUNCHPAD_HMAC_SECRET=your-hmac-secret
```

## Checklist de Segurança

Antes de fazer deploy em produção, verificar:

- [ ] `LAUNCHPAD_ENABLED=true`
- [ ] `LAUNCHPAD_MODE=real` (não stub)
- [ ] `BAGS_API_KEY` configurado e seguro
- [ ] `ALLOWED_IMAGE_DOMAINS` configurado (recomendado)
- [ ] `LAUNCHPAD_HMAC_SECRET` configurado e forte
- [ ] Security headers aplicados (verificado)
- [ ] Logs não contêm secrets (verificado)
- [ ] Rate limiting configurado
- [ ] CORS restritivo configurado
- [ ] Testes passando (`npm run test:launchpad`)

## Monitoramento

### Logs Estruturados

Todos os logs são em JSON e podem ser parseados facilmente:

```json
{
  "level": "info",
  "message": "Token created successfully",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "endpoint": "/api/launchpad/token-info",
  "elapsedMs": 45
}
```

### Métricas Importantes

- Taxa de erro por endpoint
- Tempo de resposta (elapsedMs)
- Taxa de rate limiting (429)
- Uso de modo stub vs real
- Erros de validação (400)

## Troubleshooting

### Endpoint retorna 503 FEATURE_DISABLED

**Causa**: `LAUNCHPAD_ENABLED` não está configurado ou é `false`

**Solução**: Configurar `LAUNCHPAD_ENABLED=true`

### Modo stub sempre ativo

**Causa**: `LAUNCHPAD_MODE` não configurado ou é `stub`

**Solução**: Configurar `LAUNCHPAD_MODE=real` e garantir `BAGS_API_KEY` configurado

### URLs de imagem rejeitadas

**Causa**: Domínio não está na allowlist ou é bloqueado por anti-SSRF

**Solução**: 
- Verificar se domínio é público válido
- Adicionar à `ALLOWED_IMAGE_DOMAINS` se necessário
- Verificar que não é localhost ou IP privado

### Logs muito verbosos

**Causa**: Modo debug ativo ou logs em desenvolvimento

**Solução**: Verificar `NODE_ENV` e garantir que não é `development` em produção

## Referências

- [API Documentation](./API.md) - Documentação completa da API
- [Architecture](./ARCHITECTURE.md) - Arquitetura do sistema
- [Threat Model](./THREAT_MODEL.md) - Modelo de ameaças
