# 🏗️ Arquitetura da Launchpad - Bags Shield

## Visão Geral

A Launchpad do Bags Shield segue uma arquitetura em camadas (layered architecture) com separação clara de responsabilidades, garantindo segurança por padrão e manutenibilidade.

## Camadas da Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer (Next.js App Router)        │
│              src/app/launchpad/**/*.tsx                  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  API Layer (Route Handlers)              │
│            src/app/api/launchpad/**/route.ts             │
│  • CORS restritivo                                       │
│  • Rate limiting                                         │
│  • Request ID tracking                                   │
│  • Validação de schema                                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                Adapters Layer (HTTP/External)            │
│          src/lib/http/** ou src/lib/security/**          │
│  • Clientes HTTP                                         │
│  • Wrappers de segurança                                 │
│  • Transformação de dados                                │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                Services Layer (Business Logic)           │
│              src/lib/launchpad/services/**               │
│  • Lógica de negócio                                     │
│  • Orquestração                                          │
│  • Regras de validação                                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                Domain Layer (Core Entities)               │
│              src/lib/launchpad/domain/**                 │
│  • Entidades                                             │
│  • Value Objects                                         │
│  • Interfaces/Contratos                                  │
└─────────────────────────────────────────────────────────┘
```

## Detalhamento das Camadas

### 1. Domain Layer (`src/lib/launchpad/domain/`)

**Responsabilidade**: Definir entidades de domínio, value objects e contratos/interfaces.

**Características**:
- Puro TypeScript, sem dependências externas
- Define tipos e estruturas de dados
- Contratos que outras camadas devem seguir

**Exemplo de estrutura**:
```
domain/
  ├── entities/
  │   ├── LaunchpadProject.ts
  │   └── Token.ts
  ├── value-objects/
  │   ├── Address.ts
  │   └── Amount.ts
  └── interfaces/
      ├── ILaunchpadRepository.ts
      └── IProjectValidator.ts
```

### 2. Services Layer (`src/lib/launchpad/services/`)

**Responsabilidade**: Implementar lógica de negócio e orquestração.

**Características**:
- Contém regras de negócio
- Orquestra chamadas entre adapters e domain
- Validações de negócio (além de validação de schema)
- Não conhece detalhes de HTTP ou UI

**Exemplo de estrutura**:
```
services/
  ├── LaunchpadService.ts
  ├── ProjectService.ts
  └── ValidationService.ts
```

**Princípios**:
- Fail-closed: input inválido retorna erro estruturado
- Sem logs de segredos
- Sem impressão de env vars

### 3. Adapters Layer (`src/lib/http/` ou `src/lib/security/`)

**Responsabilidade**: Adaptar interfaces externas (HTTP, APIs, etc.) para o domínio.

**Características**:
- Clientes HTTP seguros
- Wrappers de segurança (sanitização, validação de URLs)
- Transformação de dados externos → domain
- Tratamento de erros de rede

**Exemplo de estrutura**:
```
http/
  ├── client.ts          # Cliente HTTP base
  ├── safe-fetch.ts      # Fetch com proteções
  └── url-validator.ts   # Validação de URLs (anti-SSRF)
```

### 4. API Layer (`src/app/api/launchpad/**/route.ts`)

**Responsabilidade**: Endpoints HTTP com segurança por padrão.

**Características obrigatórias**:
- ✅ CORS restritivo
- ✅ `no-store` cache headers
- ✅ Request ID único por requisição
- ✅ Validação de schema (usando `schemas/launchpad/**`)
- ✅ Rate limiting
- ✅ Métodos HTTP permitidos explícitos

**Estrutura padrão de endpoint**:
```typescript
// src/app/api/launchpad/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cors } from '@/lib/cors';
import { rateLimit } from '@/lib/rate';
import { validateSchema } from '@/lib/validate';
import { projectRequestSchema } from '@/schemas/launchpad/project.request.json';
import { LaunchpadService } from '@/lib/launchpad/services/LaunchpadService';

export async function POST(request: NextRequest) {
  // 1. CORS
  const corsResponse = cors(request, { methods: ['POST'] });
  if (corsResponse) return corsResponse;

  // 2. Rate limiting
  const rateLimitResponse = await rateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  // 3. Request ID
  const requestId = crypto.randomUUID();

  // 4. Parse e validação de schema
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON', issues: [{ path: 'body', message: 'Malformed JSON' }] },
      { status: 400, headers: { 'Cache-Control': 'no-store', 'X-Request-ID': requestId } }
    );
  }

  const validation = validateSchema(projectRequestSchema, body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'Validation failed', issues: validation.issues },
      { status: 400, headers: { 'Cache-Control': 'no-store', 'X-Request-ID': requestId } }
    );
  }

  // 5. Lógica de negócio
  try {
    const service = new LaunchpadService();
    const result = await service.createProject(body);

    return NextResponse.json(
      result,
      {
        status: 201,
        headers: {
          'Cache-Control': 'no-store',
          'X-Request-ID': requestId,
        },
      }
    );
  } catch (error) {
    // Fail-closed: não expor detalhes internos
    return NextResponse.json(
      { error: 'Internal server error', requestId },
      { status: 500, headers: { 'Cache-Control': 'no-store', 'X-Request-ID': requestId } }
    );
  }
}
```

### 5. UI Layer (`src/app/launchpad/**/*.tsx`)

**Responsabilidade**: Componentes React/Next.js para interface do usuário.

**Características**:
- Server Components quando possível
- Client Components apenas quando necessário (interatividade)
- Consome APIs via fetch ou server actions
- Não contém lógica de negócio

**Estrutura**:
```
app/launchpad/
  ├── page.tsx                    # Lista de projetos
  ├── [id]/
  │   └── page.tsx                # Detalhes do projeto
  └── create/
      └── page.tsx                # Criar novo projeto
```

## Fluxo de Dados

```
User Action (UI)
    ↓
API Route Handler (validação, segurança)
    ↓
Service (lógica de negócio)
    ↓
Adapter (chamadas externas, transformação)
    ↓
Domain (entidades, contratos)
    ↓
Response (UI)
```

## Princípios de Design

### 1. Segurança por Padrão
- Todos os endpoints seguem o padrão de segurança obrigatório
- Fail-closed: erros retornam 400/500 sem expor detalhes
- Validação rigorosa de entrada

### 2. TypeScript Estrito
- `strict: true` no `tsconfig.json`
- Tipos explícitos em todas as camadas
- Sem `any` sem justificativa

### 3. Organização por Camadas
- Cada camada conhece apenas a camada imediatamente abaixo
- Domain não conhece HTTP
- Services não conhecem UI

### 4. Testabilidade
- Camadas podem ser testadas independentemente
- Mocks/interfaces facilitam testes unitários
- Domain puro facilita testes de lógica

## Schemas e Validação

**Localização**: `schemas/launchpad/**`

Todos os endpoints devem validar entrada usando schemas JSON Schema:
- `*.request.json` - Schema de requisição
- `*.response.json` - Schema de resposta (opcional, para documentação)

Validação usando `lib/validate.ts` que deve retornar:
```typescript
{
  valid: boolean;
  issues?: Array<{ path: string; message: string }>;
}
```

## Dependências

### Regra de Dependências
- ❌ **NÃO** adicionar dependências sem justificar
- ✅ **PERMITIDO**: Dependências de segurança, validação, HTTP
- 📝 **OBRIGATÓRIO**: Documentar motivo de cada dependência nova

### Dependências Comuns Permitidas
- `zod` ou `ajv` - Validação de schemas
- `next` - Framework (já presente)
- Bibliotecas de segurança (ex: `helmet`, `validator`)

## Documentação Adicional

- [THREAT_MODEL.md](./THREAT_MODEL.md) - Modelo de ameaças e mitigações
- [LOCKED_UI.md](../LOCKED_UI.md) - Regras de proteção de UI

---

**Última atualização**: 2024-12-19  
**Versão**: 1.0.0
