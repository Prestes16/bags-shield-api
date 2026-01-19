# Correções de Erros - Bags Shield API
**Data:** 2026-01-19

---

## 🔍 Scan Completo Realizado

Foi realizado um scan completo do projeto procurando por:
- Erros 500 (Internal Server Error)
- Erros 501 (Not Implemented)
- Erros 404 (Not Found)
- Imports incorretos (`.js` que causam erro 500)
- Vazamento de stacktrace em produção
- Tratamento inadequado de erros

---

## ✅ Correções Aplicadas

### 1. `api/apply.ts`
**Problemas encontrados:**
- ❌ Imports com `.js` (linha 2-3) → Causa erro 500
- ❌ `setCors(res)` sem `req` → CORS não dinâmico
- ❌ Erro 500 pode vazar stacktrace

**Correções:**
- ✅ Imports corrigidos: `from "../lib/cors"` e `from "../lib/rate"`
- ✅ `setCors(res, req)` atualizado
- ✅ Proteção contra stacktrace: verifica `isDev` antes de mostrar detalhes

### 2. `api/bags/[...route].ts`
**Problemas encontrados:**
- ❌ Retorna 500 quando `BAGS_API_KEY` ausente (linha 209) → Deveria ser 501
- ❌ Erros 500 podem vazar stacktrace em `token-info` e `create-config`

**Correções:**
- ✅ Retorna 501 (não 500) quando `BAGS_API_KEY` ausente
- ✅ Mensagem clara: "BAGS_API_KEY not set. This endpoint requires upstream API key configuration."
- ✅ Proteção contra stacktrace em todos os catch blocks

### 3. `api/webhooks/vercel.ts`
**Problemas encontrados:**
- ❌ Imports com `.js` (linha 3-4) → Causa erro 500
- ❌ `preflight` sem parâmetros completos

**Correções:**
- ✅ Imports corrigidos: `from "../../lib/cors"` e `from "../../lib/http"`
- ✅ `preflight` atualizado com parâmetros completos

### 4. `api/simulate.ts`
**Problemas encontrados:**
- ❌ Erro 500 pode vazar mensagem de erro em produção

**Correções:**
- ✅ Proteção contra stacktrace: verifica `isDev` antes de mostrar detalhes
- ✅ Mensagem genérica "Internal server error" em produção

### 5. `api/scan.ts`
**Status:** ✅ Já estava correto
- Dynamic imports implementados
- Proteção contra stacktrace
- Validação robusta

### 6. `api/ai/image.ts`
**Status:** ✅ Já estava correto
- Retorna 501 quando provider não implementado
- Modo stub quando `AI_API_KEY` ausente
- Proteção contra stacktrace

---

## 📊 Resumo das Correções

| Arquivo | Problema | Status |
|---------|----------|--------|
| `api/apply.ts` | Imports `.js` + stacktrace | ✅ Corrigido |
| `api/bags/[...route].ts` | 500 → 501 + stacktrace | ✅ Corrigido |
| `api/webhooks/vercel.ts` | Imports `.js` | ✅ Corrigido |
| `api/simulate.ts` | Stacktrace leak | ✅ Corrigido |
| `api/scan.ts` | - | ✅ Já estava OK |
| `api/ai/image.ts` | - | ✅ Já estava OK |

---

## 🔒 Melhorias de Segurança

### Proteção Contra Stacktrace
Todos os endpoints agora verificam ambiente antes de mostrar detalhes:
```typescript
const isDev = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "development";
const errorMessage = isDev ? (e?.message || String(e)) : "internal server error";
```

### Status Codes Corretos
- **500**: Apenas para erros internos reais (com proteção)
- **501**: Para "not configured" (BAGS_API_KEY ausente)
- **400**: Para input inválido
- **405**: Para método não permitido
- **404**: Não usado (todos endpoints existem)

---

## 🧪 Como Verificar

### Testar Endpoints Corrigidos:
```powershell
# 1. Testar /api/apply (não deve dar 500 por import)
curl.exe -X POST "https://bags-shield-api.vercel.app/api/apply" -H "Content-Type: application/json" -d "{}"

# 2. Testar /api/bags/trending sem API key (deve ser 501, não 500)
curl.exe "https://bags-shield-api.vercel.app/api/bags/trending"

# 3. Testar /api/scan (não deve dar 500)
$body = '{"rawTransaction":"QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=","network":"mainnet"}'
curl.exe -X POST "https://bags-shield-api.vercel.app/api/scan" -H "Content-Type: application/json" --data $body
```

### Executar Scan de Erros:
```powershell
cd C:\Dev\bags-shield-api
.\scripts\scan-errors.ps1
```

---

## 📝 Próximos Passos

1. **Deploy das correções:**
   ```powershell
   git add -A
   git commit -m "fix(api): corrige imports .js e proteção stacktrace"
   git commit -m "fix(bags): retorna 501 quando BAGS_API_KEY ausente"
   git push
   ```

2. **Validar em produção:**
   - Verificar logs da Vercel
   - Executar testes de integração
   - Monitorar erros 500

3. **Monitoramento contínuo:**
   - Usar `scripts/scan-errors.ps1` regularmente
   - Verificar logs da Vercel periodicamente

---

**Status:** ✅ Todas as correções aplicadas
