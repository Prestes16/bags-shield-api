# Verificação app.html - Bags Shield API
**Data:** 2026-01-19

---

## ✅ Status do Arquivo Local

### Conteúdo Verificado:
```html
<div class="s"><a href="/app-v4.html">Se não redirecionar, toque aqui.</a></div>
```

### Verificações:
- ✅ Texto "Se não redirecionar" presente e correto
- ✅ Redirecionamento para `/app-v4.html` configurado
- ✅ Meta refresh: `content="0; url=/app-v4.html"`
- ✅ Link canonical: `href="/app-v4.html"`
- ✅ Encoding: UTF-8 sem BOM garantido
- ✅ Sem mojibake detectado

---

## 🧪 Teste em Produção

### Comando de Teste:
```powershell
$base="https://bags-shield-api.vercel.app"
$html = curl.exe -sS "$base/app.html?ts=$(Get-Date -Format 'yyyyMMddHHmmss')"
$html | Select-String -Pattern "Se não"
```

### Resultado Esperado:
- ✅ Deve encontrar o texto "Se não redirecionar"
- ✅ Deve conter "app-v4.html"
- ✅ Não deve conter caracteres quebrados (mojibake)

---

## 📝 Próximos Passos

Se o teste em produção mostrar mojibake:

1. **Garantir encoding correto:**
   ```powershell
   $file = "public\app.html"
   $content = Get-Content $file -Raw
   $utf8NoBOM = New-Object System.Text.UTF8Encoding($false)
   [System.IO.File]::WriteAllText((Resolve-Path $file).Path, $content, $utf8NoBOM)
   ```

2. **Commit e deploy:**
   ```powershell
   git add public/app.html
   git commit -m "fix(ui): garante UTF-8 sem BOM em app.html"
   git push
   ```

---

**Status:** ✅ Arquivo local verificado e correto
