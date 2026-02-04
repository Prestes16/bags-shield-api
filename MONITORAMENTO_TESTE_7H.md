# Monitoramento do Teste de 7 Horas

**Iniciado em:** 2026-01-19 08:00:03

---

## ✅ Status: TESTE EM EXECUÇÃO

O teste de stress está rodando em background com os seguintes parâmetros:
- **Duração:** 7 horas
- **Taxa:** 60 requisições por minuto
- **Total esperado:** ~25,200 requisições
- **Base URL:** https://bags-shield-api.vercel.app

---

## 📊 Como Monitorar o Progresso

### 1. Verificar se o processo está rodando:
```powershell
Get-Process powershell | Where-Object { $_.CommandLine -like "*test-stress-load*" }
```

### 2. Ver logs em tempo real:
```powershell
# Ver último arquivo de erro (atualiza em tempo real)
Get-Content logs\stress-errors-*.txt -Tail 20 -Wait

# Ver estatísticas parciais (se o script salvar periodicamente)
Get-ChildItem logs\stress-test-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Get-Content
```

### 3. Verificar progresso aproximado:
```powershell
# Contar linhas no log de erros (cada erro = 1 linha)
$errorFile = Get-ChildItem logs\stress-errors-*.txt | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($errorFile) {
    $errorCount = (Get-Content $errorFile.FullName | Measure-Object -Line).Lines
    Write-Host "Erros registrados até agora: $errorCount"
}
```

---

## 📁 Arquivos Gerados

### Durante a execução:
- `logs/stress-errors-YYYYMMDD-HHMMSS.txt` - Log de erros em tempo real
- Console output (se executado em foreground)

### Ao finalizar:
- `logs/stress-test-YYYYMMDD-HHMMSS.json` - Estatísticas completas
  - Total de requisições
  - Taxa de sucesso/falha
  - Performance por endpoint
  - Análise de degradação

---

## ⏸️ Como Parar o Teste

### Se executado em foreground:
- Pressione `Ctrl+C`

### Se executado em background:
```powershell
# Encontrar processo
$proc = Get-Process powershell | Where-Object { $_.CommandLine -like "*test-stress-load*" }

# Parar processo
if ($proc) {
    Stop-Process -Id $proc.Id -Force
    Write-Host "Teste interrompido"
}
```

---

## 📈 Análise dos Resultados (Após Conclusão)

### 1. Ver resumo geral:
```powershell
$data = Get-Content logs\stress-test-*.json | ConvertFrom-Json
$data.statistics | Format-List
```

### 2. Ver estatísticas por endpoint:
```powershell
$data = Get-Content logs\stress-test-*.json | ConvertFrom-Json
$data.statistics.endpoints | Format-Table -AutoSize
```

### 3. Ver todos os erros:
```powershell
Get-Content logs\stress-errors-*.txt
```

### 4. Análise de performance:
```powershell
$data = Get-Content logs\stress-test-*.json | ConvertFrom-Json

# Verificar degradação (comparar tempos iniciais vs finais)
foreach ($endpoint in $data.statistics.endpoints.PSObject.Properties.Name) {
    $ep = $data.statistics.endpoints.$endpoint
    Write-Host "`n$endpoint :" -ForegroundColor Cyan
    Write-Host "  Total: $($ep.total)"
    Write-Host "  Sucesso: $($ep.success) ($([math]::Round($ep.success/$ep.total*100, 2))%)"
    Write-Host "  Falhas: $($ep.failed)"
    Write-Host "  Tempo médio: $($ep.avgTime)ms"
    Write-Host "  Tempo P95: $($ep.p95Time)ms"
    Write-Host "  Tempo máximo: $($ep.maxTime)ms"
}
```

---

## 🔍 O Que Procurar nos Resultados

### ✅ Indicadores de Saúde:
- Taxa de sucesso > 99%
- Tempo médio estável ao longo do tempo
- Sem aumento progressivo de erros
- P95 time razoável (< 2s)

### ⚠️ Sinais de Problemas:
- Taxa de sucesso < 95%
- Tempo de resposta aumentando progressivamente (memory leak)
- Muitos timeouts
- Erros 500 inesperados
- Degradação de performance ao longo do tempo

---

## 📝 Próximos Passos Após Conclusão

1. **Analisar resultados:**
   ```powershell
   .\scripts\analyze-stress-results.ps1 -LogFile logs\stress-test-*.json
   ```

2. **Gerar relatório:**
   - Criar documento com findings
   - Listar bugs encontrados
   - Recomendar melhorias

3. **Corrigir problemas:**
   - Priorizar bugs críticos
   - Otimizar endpoints lentos
   - Corrigir memory leaks

---

**Teste iniciado em:** 2026-01-19 08:00:03  
**Previsão de término:** 2026-01-19 15:00:03
