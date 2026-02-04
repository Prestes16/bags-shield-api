# Resultado do Scan de Erros - Bags Shield API
**Data:** 2026-01-19

---

## 🔍 Scan Completo Realizado

### Arquivos Escaneados
- ✅ Todos os arquivos em `api/`
- ✅ Verificação de imports
- ✅ Verificação de status codes (500, 501, 404)
- ✅ Verificação de vazamento de stacktrace
- ✅ Verificação de tratamento de erros

---

## ❌ Erros Críticos Encontrados e Corrigidos

### 1. `api/apply.ts`
**Erro:** Imports com `.js` causando `FUNCTION_INVOCATION_FAILED` (500)
```typescript
// ANTES (ERRADO):
import { setCors, guardMethod, noStore, ensureRequestId } from '.js';
import { rateLimitMiddleware } from '../lib/rate.js';

// DEPOIS (CORRIGIDO):
import { setCors, guardMethod, noStore, ensureRequestId } from "../lib/cors";
import { rateLimitMiddleware } from "../lib/rate";
```

**Status:** ✅ Corrigido

---

### 2. `api/bags/[...route].ts`
**Erro 1:** Retorna 500 quando `BAGS_API_KEY` ausente (deveria ser 501)
```typescript
// ANTES (ERRADO):
if (!apiKey) {
  return send(res, 500, { success: false, error: "Missing BAGS_API_KEY" });
}

// DEPOIS (CORRIGIDO):
if (!apiKey) {
  const requestId = ensureRequestId(res);
  return send(res, 501, { 
    success: false, 
    error: "server_not_configured",
    message: "BAGS_API_KEY not set. This endpoint requires upstream API key configuration.",
    meta: { requestId }
  });
}
```

**Erro 2:** Vazamento de stacktrace em catch blocks
```typescript
// ANTES (ERRADO):
catch (e: any) {
  return send(res, 500, {
    error: "token-info error",
    message: e?.message || String(e),  // Vaza em produção
  });
}

// DEPOIS (CORRIGIDO):
catch (e: any) {
  console.error("[bags/token-info] Error:", e?.message || String(e));
  const isDev = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "development";
  return send(res, 500, {
    error: "token-info error",
    message: isDev ? (e?.message || String(e)) : "internal server error",
    meta: { requestId }
  });
}
```

**Status:** ✅ Corrigido

---

### 3. `api/webhooks/vercel.ts`
**Erro:** Imports com `.js` causando erro 500
```typescript
// ANTES (ERRADO):
import { preflight, guardMethod, ensureRequestId } from '.js';
import { unauthorized, ok } from '../../lib/http.js';

// DEPOIS (CORRIGIDO):
import { preflight, guardMethod, ensureRequestId } from "../../lib/cors";
import { unauthorized, ok } from "../../lib/http";
```

**Status:** ✅ Corrigido

---

### 4. `api/simulate.ts`
**Erro:** Vazamento de mensagem de erro em produção
```typescript
// ANTES (ERRADO):
catch (error) {
  res.status(500).json({
    error: {
      message: error instanceof Error ? error.message : "Internal server error",
      // Sempre mostra mensagem, mesmo em produção
    },
  });
}

// DEPOIS (CORRIGIDO):
catch (error) {
  const isDev = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "development";
  res.status(500).json({
    error: {
      message: isDev ? (error instanceof Error ? error.message : "Internal server error") : "Internal server error",
    },
  });
}
```

**Status:** ✅ Corrigido

---

## ✅ Arquivos Já Corretos

### `api/scan.ts`
- ✅ Dynamic imports implementados
- ✅ Proteção contra stacktrace
- ✅ Validação robusta
- ✅ Tratamento de erros adequado

### `api/ai/image.ts`
- ✅ Retorna 501 quando provider não implementado
- ✅ Modo stub quando `AI_API_KEY` ausente
- ✅ Proteção contra stacktrace

---

## 📊 Resumo Final

| Tipo de Erro | Quantidade | Status |
|--------------|------------|--------|
| Imports `.js` incorretos | 2 | ✅ Corrigido |
| Status 500 incorreto (deveria ser 501) | 1 | ✅ Corrigido |
| Vazamento de stacktrace | 3 | ✅ Corrigido |
| `setCors` sem `req` | 1 | ✅ Corrigido |

---

## 🔒 Melhorias Aplicadas

### 1. Proteção Contra Stacktrace
Todos os endpoints agora verificam ambiente:
```typescript
const isDev = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "development";
const errorMessage = isDev ? (e?.message || String(e)) : "internal server error";
```

### 2. Status Codes Corretos
- **500**: Apenas erros internos reais (com proteção)
- **501**: "Not configured" (BAGS_API_KEY ausente)
- **400**: Input inválido
- **405**: Método não permitido

### 3. Imports Corretos
Todos os imports agora usam caminhos relativos sem `.js`:
- ✅ `from "../lib/cors"`
- ✅ `from "../../lib/http"`
- ✅ `from "../lib/rate"`

---

## 🧪 Validação

### Testes Realizados:
1. ✅ Verificação de imports (nenhum `.js` encontrado)
2. ✅ Verificação de status codes (500/501 corretos)
3. ✅ Verificação de stacktrace (proteção aplicada)
4. ✅ Linter (sem erros)

### Como Testar:
```powershell
# Executar scan de erros
.\scripts\scan-errors.ps1

# Testar endpoints corrigidos
curl.exe -X POST "https://bags-shield-api.vercel.app/api/apply" -H "Content-Type: application/json" -d "{}"
```

---

## 📝 Próximos Passos

1. **Commit das correções:**
   ```powershell
   git add -A
   git commit -m "fix(api): corrige imports .js que causavam erro 500"
   git commit -m "fix(api): protege contra vazamento de stacktrace"
   git commit -m "fix(bags): retorna 501 quando BAGS_API_KEY ausente"
   git push
   ```

2. **Validar em produção:**
   - Verificar logs da Vercel
   - Executar testes de integração
   - Monitorar erros 500

---

**Status:** ✅ Todos os erros críticos corrigidos
