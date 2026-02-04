# Correção de Imports ESM - Bags Shield API
**Data:** 2026-01-19

---

## 🔧 Problema Identificado

Imports ESM em TypeScript precisam da extensão `.js` mesmo que o arquivo fonte seja `.ts`. Isso é necessário porque:
- TypeScript compila `.ts` para `.js`
- ESM requer extensões explícitas
- Sem `.js`, o Vercel retorna erro 500 `FUNCTION_INVOCATION_FAILED`

---

## ✅ Correções Aplicadas

### Arquivos Corrigidos:

1. **`api/scan.ts`**
   - ✅ `await import("../lib/cors")` → `await import("../lib/cors.js")`

2. **`api/simulate.ts`**
   - ✅ `await import("../lib/cors")` → `await import("../lib/cors.js")`
   - ✅ `await import("../lib/http")` → `await import("../lib/http.js")`
   - ✅ `await import("../lib/env")` → `await import("../lib/env.js")`
   - ✅ `await import("../lib/rate")` → `await import("../lib/rate.js")`

3. **`api/apply.ts`**
   - ✅ `from "../lib/cors"` → `from "../lib/cors.js"`
   - ✅ `from "../lib/rate"` → `from "../lib/rate.js"`

4. **`api/bags/[...route].ts`**
   - ✅ `from "../lib/cors"` → `from "../lib/cors.js"`
   - ✅ `from "../lib/payload-validation"` → `from "../lib/payload-validation.js"`

5. **`api/webhooks/vercel.ts`**
   - ✅ `from "../../lib/cors"` → `from "../../lib/cors.js"`
   - ✅ `from "../../lib/http"` → `from "../../lib/http.js"`

6. **`api/ai/image.ts`**
   - ✅ `from "../../lib/cors"` → `from "../../lib/cors.js"`
   - ✅ `from "../../lib/payload-validation"` → `from "../../lib/payload-validation.js"`

---

## 📝 Padrão de Correção

### Imports Estáticos:
```typescript
// ANTES (ERRADO):
import { setCors } from "../lib/cors";

// DEPOIS (CORRETO):
import { setCors } from "../lib/cors.js";
```

### Dynamic Imports:
```typescript
// ANTES (ERRADO):
return await import("../lib/cors");

// DEPOIS (CORRETO):
return await import("../lib/cors.js");
```

---

## 🧪 Validação

### Teste do Endpoint:
```powershell
$base="https://bags-shield-api.vercel.app"
$body = '{"rawTransaction":"QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=","network":"mainnet"}'
curl.exe -sS -D - "$base/api/scan" -H "Content-Type: application/json" --data $body
```

**Resultado Esperado:**
- ✅ HTTP 200 com `{success:true, response:{...}}`
- ✅ OU HTTP 400 com `{success:false, error:"..."}`
- ❌ NUNCA HTTP 500 por `FUNCTION_INVOCATION_FAILED`

---

## 🚀 Deploy

### Commands Executados:
```powershell
git add api/scan.ts api/simulate.ts api/apply.ts api/bags/[...route].ts api/webhooks/vercel.ts api/ai/image.ts
git commit -m "fix(api): ESM imports with .js for all endpoints"
git push
npx vercel@latest --prod --yes
```

---

## ✅ Status

- ✅ Todos os imports ESM corrigidos
- ✅ Commit e push realizados
- ✅ Deploy para produção executado
- ✅ Endpoint `/api/scan` deve retornar 200/400 (nunca 500)

---

**Última atualização:** 2026-01-19
