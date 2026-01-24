# Proxy Setup - Bags Shield API

## Visão Geral

As rotas `/api/scan` e `/api/simulate` agora funcionam como **proxies** para o backend real da Bags Shield API (Vercel). Isso permite:

- ✅ Sem problemas de CORS
- ✅ Trocar base URL via `.env.local`
- ✅ UI continua igual, só muda fonte de dados

## Configuração

### 1. Adicionar ao `.env.local`

```bash
# Base URL do backend real da Bags Shield API
BAGS_SHIELD_API_BASE=https://bags-shield-api.vercel.app
```

### 2. Rotas Disponíveis

- **`POST /api/scan`** → Proxy para `/api/scan` do backend
- **`GET /api/scan`** → Proxy para `/api/scan` do backend
- **`POST /api/simulate`** → Proxy para `/api/simulate` do backend
- **`GET /api/simulate`** → Proxy para `/api/simulate` do backend

## Como Funciona

1. **Request chega** em `/api/scan` ou `/api/simulate`
2. **Proxy verifica** se `BAGS_SHIELD_API_BASE` está configurado
3. **Se configurado**: Forward request para backend real
4. **Se não configurado**: Retorna `501` com erro `MISSING_BAGS_SHIELD_API_BASE`
5. **Response** é retornada como está (preserva JSON, headers, status)

## Exemplo de Uso

### Com Backend Configurado

```typescript
// .env.local
BAGS_SHIELD_API_BASE=https://bags-shield-api.vercel.app

// Frontend (UI)
const response = await fetch("/api/scan", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    rawTransaction: "AQAAAAAAAAAAAAAA",
  }),
});

const data = await response.json();
// data vem do backend real via proxy
```

### Sem Backend Configurado

```json
{
  "success": false,
  "error": {
    "code": "MISSING_BAGS_SHIELD_API_BASE",
    "message": "BAGS_SHIELD_API_BASE environment variable is not configured"
  }
}
```

Status: `501 Not Implemented`

## Headers Preservados

O proxy preserva e encaminha:

- **Request → Backend**:
  - `Content-Type`
  - `Accept`
  - `X-Request-Id` (se presente)

- **Backend → Response**:
  - `Content-Type`
  - `X-Request-Id` (se presente)
  - `Cache-Control: no-store` (sempre adicionado)

## Tratamento de Erros

### Erro de Configuração (501)
```json
{
  "success": false,
  "error": {
    "code": "MISSING_BAGS_SHIELD_API_BASE",
    "message": "..."
  }
}
```

### Erro de Conexão (502)
```json
{
  "success": false,
  "error": {
    "code": "UPSTREAM_ERROR",
    "message": "Failed to connect to backend API"
  }
}
```

### Erro de Request Body (400)
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Failed to read request body"
  }
}
```

## Desenvolvimento Local

Para desenvolvimento local, você pode:

1. **Usar backend real (Vercel):
   ```bash
   BAGS_SHIELD_API_BASE=https://bags-shield-api.vercel.app
   ```

2. **Usar backend local (se rodando):
   ```bash
   BAGS_SHIELD_API_BASE=http://localhost:3000
   ```

3. **Sem proxy (desabilitar):
   ```bash
   # Não configure BAGS_SHIELD_API_BASE
   # Rotas retornarão 501
   ```

## Benefícios

1. **Sem CORS**: Todas as requisições são server-side
2. **Flexível**: Troca de backend via env sem mudar código
3. **Transparente**: UI não precisa saber que é proxy
4. **Seguro**: Headers e body são validados antes de forward
5. **Rastreável**: `X-Request-Id` é preservado end-to-end

## Próximos Passos

1. Configure `BAGS_SHIELD_API_BASE` no `.env.local`
2. Teste as rotas `/api/scan` e `/api/simulate`
3. UI deve funcionar normalmente, agora com dados reais!
