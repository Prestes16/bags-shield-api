# 🛡️ Modelo de Ameaças - Launchpad Bags Shield

## Visão Geral

Este documento identifica ameaças de segurança específicas para a Launchpad e as mitigações implementadas em cada camada da arquitetura.

## Ameaças Identificadas

### 1. SSRF (Server-Side Request Forgery) via `imageUrl`

**Descrição**: Atacante fornece URL maliciosa em campos como `imageUrl` que faz o servidor fazer requisições HTTP para recursos internos ou externos não autorizados.

**Cenários de Ataque**:
- `imageUrl: "http://localhost:8080/admin"` - Acesso a serviços internos
- `imageUrl: "http://169.254.169.254/latest/meta-data/"` - Acesso a metadados AWS
- `imageUrl: "file:///etc/passwd"` - Acesso a arquivos locais
- `imageUrl: "http://internal-api:3000/secrets"` - Acesso a APIs internas

**Mitigação**:
```typescript
// src/lib/security/url-validator.ts
export function validateImageUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    // 1. Apenas HTTP/HTTPS permitidos
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP/HTTPS URLs allowed' };
    }
    
    // 2. Bloquear localhost e IPs privados
    const hostname = parsed.hostname.toLowerCase();
    const blockedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '169.254.169.254', // AWS metadata
    ];
    
    if (blockedHosts.includes(hostname)) {
      return { valid: false, error: 'Private/localhost URLs not allowed' };
    }
    
    // 3. Bloquear IPs privados (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(hostname)) {
      const parts = hostname.split('.').map(Number);
      const isPrivate =
        parts[0] === 10 ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168);
      
      if (isPrivate) {
        return { valid: false, error: 'Private IP addresses not allowed' };
      }
    }
    
    // 4. Whitelist de domínios permitidos (opcional, mas recomendado)
    const allowedDomains = process.env.ALLOWED_IMAGE_DOMAINS?.split(',') || [];
    if (allowedDomains.length > 0 && !allowedDomains.includes(parsed.hostname)) {
      return { valid: false, error: 'Domain not in whitelist' };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
```

**Onde aplicar**: 
- Adapter Layer: Validar todas as URLs antes de fazer requisições
- Schema validation: Incluir validação de URL no JSON Schema

---

### 2. Replay Attacks

**Descrição**: Atacante captura requisição válida e a reenvia múltiplas vezes para causar ações duplicadas (ex: criar projeto duas vezes).

**Cenários de Ataque**:
- Interceptar requisição POST de criação de projeto
- Reenviar múltiplas vezes
- Resultado: Múltiplos projetos criados com mesmos dados

**Mitigação**:
```typescript
// src/lib/security/idempotency.ts
import { createHash } from 'crypto';

interface IdempotencyStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl: number): Promise<void>;
}

export class IdempotencyHandler {
  constructor(private store: IdempotencyStore) {}
  
  async checkIdempotency(
    requestId: string,
    method: string,
    body: unknown
  ): Promise<{ isReplay: boolean; cachedResponse?: unknown }> {
    // Criar chave idempotente baseada em requestId + hash do body
    const bodyHash = createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex');
    
    const key = `idempotency:${requestId}:${method}:${bodyHash}`;
    
    const cached = await this.store.get(key);
    if (cached) {
      return { isReplay: true, cachedResponse: JSON.parse(cached) };
    }
    
    return { isReplay: false };
  }
  
  async storeResponse(
    requestId: string,
    method: string,
    body: unknown,
    response: unknown,
    ttlSeconds: number = 3600
  ): Promise<void> {
    const bodyHash = createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex');
    
    const key = `idempotency:${requestId}:${method}:${bodyHash}`;
    await this.store.set(key, JSON.stringify(response), ttlSeconds);
  }
}
```

**Uso no endpoint**:
```typescript
// No route handler
const idempotency = await idempotencyHandler.checkIdempotency(requestId, 'POST', body);
if (idempotency.isReplay) {
  return NextResponse.json(idempotency.cachedResponse, { status: 200 });
}
```

**Onde aplicar**: 
- API Layer: Verificar idempotência antes de processar requisições mutantes (POST, PUT, DELETE)

---

### 3. Abuso de Rate Limit

**Descrição**: Atacante tenta contornar rate limiting usando múltiplos IPs, proxies, ou distribuindo requisições ao longo do tempo.

**Cenários de Ataque**:
- Usar múltiplos IPs para fazer muitas requisições
- Usar proxies/VPNs para mascarar origem
- Slowloris: manter conexões abertas por muito tempo

**Mitigação**:
```typescript
// src/lib/rate.ts (melhorias)
import { Redis } from 'ioredis'; // ou outro store distribuído

export async function rateLimit(
  request: NextRequest,
  options: {
    windowMs?: number;
    maxRequests?: number;
    keyGenerator?: (req: NextRequest) => string;
  } = {}
): Promise<NextResponse | null> {
  const {
    windowMs = 60000, // 1 minuto
    maxRequests = 10,
    keyGenerator = (req) => {
      // Usar IP + User-Agent como chave (pode ser melhorado com token de auth)
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                 req.headers.get('x-real-ip') || 
                 'unknown';
      const ua = req.headers.get('user-agent') || 'unknown';
      return `rate:${ip}:${ua}`;
    },
  } = options;
  
  const key = keyGenerator(request);
  const redis = new Redis(process.env.REDIS_URL);
  
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, Math.ceil(windowMs / 1000));
  }
  
  if (current > maxRequests) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: windowMs / 1000 },
      { status: 429, headers: { 'Retry-After': String(windowMs / 1000) } }
    );
  }
  
  return null; // Permitir requisição
}
```

**Melhorias adicionais**:
- Rate limiting por usuário autenticado (se aplicável)
- Rate limiting diferenciado por endpoint (criação mais restritiva)
- Sliding window em vez de fixed window
- Rate limiting distribuído (Redis) para múltiplas instâncias

**Onde aplicar**: 
- API Layer: Aplicar em todos os endpoints públicos

---

### 4. HTTP Request Smuggling

**Descrição**: Atacante envia requisição HTTP malformada que é interpretada diferentemente por proxy e servidor, permitindo bypass de segurança.

**Cenários de Ataque**:
- Requisição com `Content-Length` e `Transfer-Encoding` conflitantes
- Chunked encoding malformado
- Headers duplicados

**Mitigação**:
```typescript
// src/lib/http/safe-parser.ts
export function sanitizeRequest(request: NextRequest): {
  isValid: boolean;
  error?: string;
} {
  // Next.js já faz parsing seguro, mas podemos adicionar validações extras
  
  // 1. Verificar Content-Length vs body real
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const expectedLength = parseInt(contentLength, 10);
    if (isNaN(expectedLength) || expectedLength < 0) {
      return { isValid: false, error: 'Invalid Content-Length header' };
    }
    
    // Limitar tamanho máximo
    if (expectedLength > 10 * 1024 * 1024) { // 10MB
      return { isValid: false, error: 'Request body too large' };
    }
  }
  
  // 2. Verificar Transfer-Encoding (Next.js não suporta chunked em serverless)
  const transferEncoding = request.headers.get('transfer-encoding');
  if (transferEncoding && transferEncoding.toLowerCase() !== 'identity') {
    return { isValid: false, error: 'Transfer-Encoding not supported' };
  }
  
  // 3. Verificar headers duplicados (Next.js já normaliza, mas documentar)
  
  return { isValid: true };
}
```

**Configuração do servidor**:
- Usar `next.config.js` para limitar tamanho de body
- Configurar Vercel/edge para rejeitar requisições malformadas

**Onde aplicar**: 
- API Layer: Validar requisição antes de processar
- Infraestrutura: Configurar limites no servidor/proxy

---

### 5. JSON Parsing Frágil

**Descrição**: Parsing de JSON sem validação adequada pode causar DoS (deeply nested objects) ou permitir injection.

**Cenários de Ataque**:
- JSON extremamente aninhado causa stack overflow
- JSON muito grande causa consumo excessivo de memória
- JSON malformado causa exceções não tratadas

**Mitigação**:
```typescript
// src/lib/http/safe-json.ts
const MAX_JSON_DEPTH = 32;
const MAX_JSON_SIZE = 10 * 1024 * 1024; // 10MB

export async function safeJsonParse<T>(
  request: NextRequest
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const text = await request.text();
    
    // 1. Verificar tamanho
    if (text.length > MAX_JSON_SIZE) {
      return { success: false, error: 'JSON payload too large' };
    }
    
    // 2. Verificar profundidade antes de parsear
    const depth = calculateJsonDepth(text);
    if (depth > MAX_JSON_DEPTH) {
      return { success: false, error: 'JSON nesting too deep' };
    }
    
    // 3. Parsear com limite de profundidade
    const data = JSON.parse(text, (key, value) => {
      // Callback pode ser usado para validação adicional
      return value;
    });
    
    return { success: true, data: data as T };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false, error: 'Invalid JSON syntax' };
    }
    return { success: false, error: 'Failed to parse JSON' };
  }
}

function calculateJsonDepth(str: string): number {
  let depth = 0;
  let maxDepth = 0;
  for (const char of str) {
    if (char === '{' || char === '[') {
      depth++;
      maxDepth = Math.max(maxDepth, depth);
    } else if (char === '}' || char === ']') {
      depth--;
    }
  }
  return maxDepth;
}
```

**Onde aplicar**: 
- API Layer: Usar `safeJsonParse` em vez de `request.json()` direto

---

### 6. Exfiltração de Secrets

**Descrição**: Logs, mensagens de erro, ou respostas HTTP expõem informações sensíveis (API keys, tokens, senhas, env vars).

**Cenários de Ataque**:
- Log de erro contém `process.env.API_KEY`
- Stack trace expõe caminhos de arquivos internos
- Resposta de erro contém dados sensíveis do banco

**Mitigação**:
```typescript
// src/lib/security/safe-logger.ts
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /api[_-]?key/i,
  /auth/i,
  /credential/i,
];

export function sanitizeForLogging(data: unknown): unknown {
  if (typeof data === 'string') {
    // Não logar env vars
    if (data.startsWith('process.env.')) {
      return '[REDACTED: env var]';
    }
    
    // Não logar valores que parecem secrets
    if (SENSITIVE_PATTERNS.some(pattern => pattern.test(data))) {
      return '[REDACTED: sensitive data]';
    }
    
    return data;
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeForLogging(value);
      }
    }
    return sanitized;
  }
  
  return data;
}

// Uso
console.log('Request:', sanitizeForLogging(requestBody));
```

**Regras**:
- ❌ Nunca logar `process.env.*`
- ❌ Nunca logar tokens, senhas, API keys
- ❌ Nunca expor stack traces completos em produção
- ✅ Logar apenas requestId, timestamps, status codes
- ✅ Usar níveis de log apropriados (error, warn, info, debug)

**Onde aplicar**: 
- Todas as camadas: Usar `sanitizeForLogging` antes de qualquer log
- API Layer: Respostas de erro não devem conter dados sensíveis

---

## Resumo de Mitigações por Camada

| Ameaça | Domain | Services | Adapters | API | UI |
|--------|--------|----------|----------|-----|-----|
| SSRF | - | Validação de regra | Validação de URL | Schema validation | - |
| Replay | - | - | - | Idempotency check | - |
| Rate Limit | - | - | - | Rate limiting | - |
| Request Smuggling | - | - | - | Sanitize request | - |
| JSON Parsing | - | - | Safe JSON parser | Safe JSON parser | - |
| Secrets Exfiltration | - | Safe logger | Safe logger | Safe logger + error handling | - |

## Checklist de Segurança por Endpoint

Ao criar um novo endpoint, verificar:

- [ ] CORS restritivo configurado
- [ ] Rate limiting aplicado
- [ ] Request ID gerado e incluído em respostas
- [ ] Cache-Control: no-store em todas as respostas
- [ ] Validação de schema aplicada
- [ ] Métodos HTTP permitidos explícitos
- [ ] URLs validadas (anti-SSRF) se aplicável
- [ ] JSON parsing seguro (tamanho, profundidade)
- [ ] Idempotency check para operações mutantes
- [ ] Logs sanitizados (sem secrets)
- [ ] Erros não expõem informações sensíveis
- [ ] Fail-closed: input inválido = 400 com issues[]

## Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP SSRF](https://owasp.org/www-community/attacks/Server_Side_Request_Forgery)
- [OWASP API Security](https://owasp.org/www-project-api-security/)

---

**Última atualização**: 2024-12-19  
**Versão**: 1.0.0
