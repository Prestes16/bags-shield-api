# 🔒 Testes de Segurança - Guia Completo

## Script de Testes Automatizados

Criei o script `scripts/test-security.mjs` que testa todas as implementações de segurança.

## Como Executar

### Pré-requisitos

1. **Servidor rodando:**

   ```bash
   pnpm dev
   ```

2. **Aguardar até ver:** `✓ Ready on http://localhost:3000`

### Executar Testes

```bash
# Em outro terminal
pnpm test:security
# ou
node scripts/test-security.mjs
```

## Testes Implementados

### 1. ✅ Rate Limiting

**Teste:** Faz 11 requisições rapidamente para `/api/scan`

**Esperado:**

- Primeiras 10: Status 200 ou 400 (validação)
- 11ª requisição: Status 429 (Rate Limit Exceeded)
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`

**Validação:**

```bash
# Deve ver:
✅ Rate Limiting (primeiras 10 requisições) -> 200 (10/10 passaram)
✅ Rate Limiting (11ª requisição bloqueada) -> 429 (rate_limit_exceeded)
```

### 2. ✅ Parameter Pollution

**Teste:** Envia campo extra `malicious: "attack"` para `/api/rpc-proxy`

**Esperado:**

- Status 400 (Bad Request)
- Erro: `validation_error`
- Mensagem indicando que campo extra foi rejeitado

**Validação:**

```bash
# Deve ver:
✅ Parameter Pollution (campo extra rejeitado) -> 400 (campo extra rejeitado corretamente)
```

### 3. ✅ Method Filtering

**Teste:** Tenta usar método `PUT` (não permitido)

**Esperado:**

- Status 405 (Method Not Allowed)
- Erro: `method_not_allowed`
- Header `Allow: GET, POST, OPTIONS`

**Validação:**

```bash
# Deve ver:
✅ Method Filtering (PUT bloqueado) -> 405 (method_not_allowed)
```

### 4. ✅ RPC Proxy

**Teste:** Chama `/api/rpc-proxy` com método `getHealth`

**Esperado:**

- Status 200 (se HELIUS_API_KEY configurada)
- Status 501 (se não configurada - esperado em dev)
- Resposta contém `result: "ok"`

**Validação:**

```bash
# Deve ver:
✅ RPC Proxy (getHealth) -> 200 (resultado: ok)
# ou
✅ RPC Proxy (getHealth) -> 501 (HELIUS_API_KEY não configurada - esperado)
```

### 5. ✅ Security Headers

**Teste:** Verifica headers de segurança em resposta OPTIONS

**Esperado:**

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=...`

**Validação:**

```bash
# Deve ver:
✅ Security Headers (presentes) -> 200 (todos os headers presentes)
```

## Testes Manuais

### Teste 1: Rate Limiting

```bash
# Fazer 11 requisições rapidamente
for i in {1..11}; do
  curl -X POST http://localhost:3000/api/scan \
    -H "Content-Type: application/json" \
    -d '{"rawTransaction":"AQAAAA..."}'
  echo ""
done

# 11ª deve retornar:
# {"success":false,"error":"rate_limit_exceeded","message":"Muitas requisições..."}
```

### Teste 2: Parameter Pollution

```bash
curl -X POST http://localhost:3000/api/rpc-proxy \
  -H "Content-Type: application/json" \
  -d '{
    "method": "getHealth",
    "params": [],
    "malicious": "attack"
  }'

# Deve retornar:
# {"success":false,"error":"validation_error","message":"Validação falhou: ..."}
```

### Teste 3: Method Filtering

```bash
curl -X PUT http://localhost:3000/api/scan

# Deve retornar:
# {"success":false,"error":"method_not_allowed","message":"Método PUT não permitido..."}
```

### Teste 4: RPC Proxy

```bash
curl -X POST http://localhost:3000/api/rpc-proxy \
  -H "Content-Type: application/json" \
  -d '{"method":"getHealth","params":[]}'

# Deve retornar (se HELIUS_API_KEY configurada):
# {"success":true,"response":"ok","meta":{...}}
```

### Teste 5: Security Headers

```bash
curl -I http://localhost:3000/api/scan

# Deve ver headers:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Referrer-Policy: strict-origin-when-cross-origin
# Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

## Resultado Esperado

Quando todos os testes passam:

```
🔒 TESTES DE SEGURANÇA - MILITARY GRADE

Base URL: http://localhost:3000

1️⃣ Testando Rate Limiting (11 requisições rápidas)...
✅ Rate Limiting (primeiras 10 requisições) -> 200 (10/10 passaram)
✅ Rate Limiting (11ª requisição bloqueada) -> 429 (rate_limit_exceeded)
   ✅ Rate limit funcionando! Headers:
      X-RateLimit-Limit: 10
      Retry-After: 60s

2️⃣ Testando Parameter Pollution (campo extra)...
✅ Parameter Pollution (campo extra rejeitado) -> 400 (campo extra rejeitado corretamente)

3️⃣ Testando Method Filtering (PUT bloqueado)...
✅ Method Filtering (PUT bloqueado) -> 405 (method_not_allowed)
   ✅ Método PUT bloqueado corretamente!

4️⃣ Testando RPC Proxy (getHealth)...
✅ RPC Proxy (getHealth) -> 200 (resultado: ok)
   ✅ RPC Proxy funcionando! Chave nunca exposta ao cliente.

5️⃣ Testando Security Headers...
✅ Security Headers (presentes) -> 200 (todos os headers presentes)
   ✅ Security headers presentes:
      x-content-type-options: nosniff
      x-frame-options: DENY
      referrer-policy: strict-origin-when-cross-origin
      strict-transport-security: max-age=63072000; includeSubDomains; preload

============================================================
📊 RESULTADO: 5/5 testes passaram
============================================================
```

## Troubleshooting

### Problema: Todos os testes falham com ECONNREFUSED

**Causa:** Servidor não está rodando  
**Solução:** Execute `pnpm dev` antes dos testes

### Problema: Rate limiting não funciona

**Causa:** Middleware não está sendo executado  
**Solução:** Verifique se `middleware.ts` está na raiz do projeto

### Problema: Parameter Pollution não é rejeitado

**Causa:** Endpoint não usa Zod `.strict()`  
**Solução:** Migre endpoint para usar `validateAndSanitize()` com schema `.strict()`

### Problema: Security headers não aparecem

**Causa:** Headers não estão sendo aplicados  
**Solução:** Verifique `middleware.ts` e `next.config.mjs`

## Próximos Passos

1. ✅ Execute `pnpm dev` para iniciar servidor
2. ✅ Execute `pnpm test:security` para validar segurança
3. ✅ Revise resultados e corrija problemas se houver
4. ✅ Migre endpoints restantes para Zod `.strict()`
5. ✅ Configure Redis para rate limiting distribuído (produção)
