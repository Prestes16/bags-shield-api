# 🔒 Security Implementation - Military Grade

## Visão Geral

Implementação de segurança de nível militar com foco em **Zero Data Leaks** e **Anti-Tampering**.

## Arquivos Criados/Modificados

### 1. `middleware.ts` ✅

**Implementações:**

- ✅ **Rate Limiting**: Token Bucket algorithm (in-memory)
- ✅ **Method Filtering**: Apenas GET e POST permitidos
- ✅ **Security Headers**: CSP, X-Frame-Options, HSTS, etc.
- ✅ **Request Validation**: Validação de métodos e rotas

**Características:**

- Rate limit: 10 requests, 2 tokens/sec, janela de 1 minuto
- Rotas sensíveis: `/api/scan`, `/api/simulate`, `/api/apply`, `/api/rpc-proxy`
- Headers aplicados em todas as respostas

### 2. `lib/security/input-sanitization.ts` ✅

**Funções de Sanitização:**

- `sanitizeString()` - Remove caracteres de controle invisíveis
- `sanitizeSolanaAddress()` - Valida e sanitiza endereços Solana
- `sanitizeMintAddress()` - Valida mint addresses
- `sanitizeTransactionSignature()` - Valida assinaturas
- `sanitizeNumber()` - Previne overflow e NaN
- `removeExtraFields()` - Remove campos extras (Parameter Pollution)

**Proteções:**

- Remove NULL bytes (injection attacks)
- Remove control characters invisíveis
- Normaliza whitespace
- Valida formato base58 para endereços Solana

### 3. `lib/security/validation-schemas.ts` ✅

**Schemas Zod com `.strict()`:**

- `scanTransactionSchema` - Validação de scan de transação
- `simulateTransactionSchema` - Validação de simulação
- `rpcProxySchema` - Validação de RPC proxy
- `jupiterQuoteSchema` - Validação de cotação Jupiter
- `jupiterSwapSchema` - Validação de swap Jupiter

**Características:**

- Todos usam `.strict()` para rejeitar campos extras
- Sanitização automática via `.transform()`
- Mensagens de erro claras

### 4. `api/rpc-proxy/route.ts` ✅

**RPC Proxy Pattern - Anti-Leak:**

- ✅ Frontend nunca vê `HELIUS_API_KEY`
- ✅ Chave é anexada apenas no servidor
- ✅ Validação com Zod `.strict()`
- ✅ Sanitização de inputs
- ✅ Error tracking integrado

**Fluxo:**

1. Frontend envia requisição RPC (sem chave)
2. Servidor valida e sanitiza payload
3. Servidor anexa `HELIUS_API_KEY`
4. Servidor repassa para Helius
5. Servidor retorna resposta (sem expor chave)

### 5. `next.config.mjs` ✅

**Security Headers (backup):**

- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Strict-Transport-Security: HSTS (2 anos)
- Permissions-Policy: Restringe APIs sensíveis

## Security Headers Implementados

### Content-Security-Policy

```
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel.app
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.gstatic.com data:
img-src 'self' data: https: blob:
connect-src 'self' https://api.jup.ag https://api-mainnet.helius-rpc.com https://mainnet.helius-rpc.com
frame-ancestors 'none'
base-uri 'self'
form-action 'self'
upgrade-insecure-requests
```

**Nota:** `unsafe-inline` e `unsafe-eval` são necessários para Next.js em desenvolvimento. Em produção, considere usar nonces.

### X-Content-Type-Options: nosniff

Previne MIME type sniffing. Browser respeita Content-Type declarado.

### X-Frame-Options: DENY

Bloqueia embedding em iframes (clickjacking prevention).

### Referrer-Policy: strict-origin-when-cross-origin

Controla informação de referrer enviada (privacy).

### Strict-Transport-Security

HSTS por 2 anos (63072000 segundos) com includeSubDomains e preload.

### Permissions-Policy

Desabilita APIs sensíveis não necessárias (geolocation, camera, microphone, etc).

## Rate Limiting

### Token Bucket Algorithm

**Configuração:**

- Capacity: 10 tokens (requests)
- Refill Rate: 2 tokens por segundo
- Window: 60 segundos

**Rotas Protegidas:**

- `/api/scan`
- `/api/simulate`
- `/api/apply`
- `/api/rpc-proxy`

**Rotas Excluídas:**

- `/api/health`
- `/api/errors` (read-only)

**Headers de Rate Limit:**

- `X-RateLimit-Limit`: Limite máximo
- `X-RateLimit-Remaining`: Tokens restantes
- `X-RateLimit-Reset`: Timestamp de reset
- `Retry-After`: Segundos até poder tentar novamente (429)

## Method Filtering

Apenas os seguintes métodos são permitidos:

- ✅ `GET` - Leitura
- ✅ `POST` - Criação/Ações
- ✅ `OPTIONS` - CORS preflight

**Bloqueados:**

- ❌ `PUT` - Atualização
- ❌ `DELETE` - Exclusão
- ❌ `PATCH` - Atualização parcial
- ❌ Outros métodos

**Resposta para métodos bloqueados:**

```json
{
  "success": false,
  "error": "method_not_allowed",
  "message": "Método PUT não permitido. Apenas GET e POST são suportados."
}
```

## Input Sanitization

### Caracteres Removidos

1. **NULL bytes** (`\0`) - Comum em injection attacks
2. **Control characters** (0x01-0x1F, exceto \t, \n, \r)
3. **DEL character** (0x7F)
4. **Unicode control characters** (U+200B-U+200D, U+FEFF)

### Validações Específicas

- **Endereços Solana**: Base58, 32-44 caracteres
- **Assinaturas**: Base58, 64-128 caracteres
- **Números**: Verificação de finitude (previne Infinity/NaN)
- **Strings**: Tamanho máximo configurável

## Parameter Pollution Prevention

### Zod `.strict()`

Todos os schemas usam `.strict()` para rejeitar campos extras:

```typescript
const schema = z
  .object({
    field1: z.string(),
    field2: z.number(),
  })
  .strict(); // Rejeita qualquer campo extra
```

**Exemplo:**

```json
// ✅ Permitido
{ "field1": "value", "field2": 123 }

// ❌ Rejeitado (campo extra)
{ "field1": "value", "field2": 123, "malicious": "attack" }
```

## RPC Proxy Pattern

### Por que usar Proxy?

**❌ ANTES (Inseguro):**

```typescript
// Frontend chama Helius diretamente
const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`);
// ⚠️ Chave exposta no cliente!
```

**✅ DEPOIS (Seguro):**

```typescript
// Frontend chama proxy
const response = await fetch('/api/rpc-proxy', {
  method: 'POST',
  body: JSON.stringify({ method: 'getBalance', params: [address] }),
});
// ✅ Chave nunca sai do servidor
```

### Endpoint: `/api/rpc-proxy`

**Request:**

```json
{
  "method": "getBalance",
  "params": ["11111111111111111111111111111111"],
  "id": "optional-request-id"
}
```

**Response:**

```json
{
  "success": true,
  "response": 1000000000,
  "meta": {
    "requestId": "...",
    "upstream": "helius",
    "upstreamStatus": 200,
    "method": "getBalance"
  }
}
```

## Auditoria de Segurança

### ✅ Verificações Realizadas

1. **Frontend não importa chaves privadas**
   - ✅ Nenhuma referência a `HELIUS_API_KEY` em `app/`
   - ✅ Nenhuma referência a `HELIUS_API_KEY` em `components/`
   - ✅ Apenas `NEXT_PUBLIC_*` variáveis no frontend

2. **Validação em todos os endpoints**
   - ✅ Zod `.strict()` implementado
   - ✅ Sanitização de inputs
   - ✅ Parameter Pollution prevention

3. **Security Headers**
   - ✅ CSP configurado
   - ✅ HSTS ativado
   - ✅ X-Frame-Options: DENY
   - ✅ X-Content-Type-Options: nosniff

4. **Rate Limiting**
   - ✅ Token Bucket implementado
   - ✅ Rotas sensíveis protegidas
   - ✅ Headers de rate limit expostos

## Próximos Passos Recomendados

1. **CSP Nonces** (Produção)
   - Implementar nonces para scripts inline
   - Remover `unsafe-inline` e `unsafe-eval`

2. **Rate Limiting Distribuído**
   - Migrar para Redis para rate limiting em múltiplas instâncias
   - Considerar Vercel Edge Config ou Upstash Redis

3. **WAF (Web Application Firewall)**
   - Configurar WAF no Vercel ou Cloudflare
   - Bloquear padrões de ataque conhecidos

4. **Monitoring & Alerting**
   - Alertas para rate limit violations
   - Monitoramento de tentativas de injection
   - Logs de segurança centralizados

5. **Penetration Testing**
   - Testes de segurança regulares
   - Bug bounty program (opcional)

## Testes de Segurança

### Testar Rate Limiting

```bash
# Fazer 11 requisições rapidamente (limite é 10)
for i in {1..11}; do
  curl -X POST http://localhost:3000/api/scan \
    -H "Content-Type: application/json" \
    -d '{"rawTransaction":"AQAAAA..."}'
done

# 11ª requisição deve retornar 429
```

### Testar Parameter Pollution

```bash
# Tentar enviar campo extra (deve ser rejeitado)
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "rawTransaction": "AQAAAA...",
    "malicious": "attack"
  }'

# Deve retornar erro de validação
```

### Testar Method Filtering

```bash
# Tentar usar método não permitido
curl -X PUT http://localhost:3000/api/scan

# Deve retornar 405 Method Not Allowed
```

## Conclusão

✅ **Zero Data Leaks**: Chaves privadas nunca expostas ao cliente  
✅ **Anti-Tampering**: Validação e sanitização em todas as entradas  
✅ **Rate Limiting**: Proteção contra DDoS básico  
✅ **Security Headers**: Proteção contra XSS, clickjacking, sniffing  
✅ **Method Filtering**: Redução de surface de ataque

**Status: 🔒 Military Grade Security Implemented**
