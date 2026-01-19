# Monitoramento do Teste de 7 Horas

**Iniciado em:** 2026-01-19 08:00:03  
**Base URL:** https://bags-shield-api.vercel.app  
**Duração:** 7 horas  
**Taxa:** 60 req/min  
**Total esperado:** ~25.200 requisições

---

## ✅ Status: TESTE EM EXECUÇÃO

---

## 1) Verificar se o processo está rodando

### Processo normal (recomendado: CIM, porque Get-Process não traz CommandLine)
```powershell
Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" |
  Where-Object { $_.CommandLine -like "*test-stress-load*" } |
  Select-Object ProcessId, Name, CommandLine
```

### Se o teste foi iniciado como Job (Start-Job)
```powershell
Get-Job | Format-Table Id, Name, State
```

---

## 2) Ver logs de erros em tempo real (tail + wait)
```powershell
$err = Get-ChildItem .\logs\stress-errors-*.txt -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($err) {
  Get-Content $err.FullName -Tail 50 -Wait
} else {
  "Sem arquivo de erro ainda."
}
```

---

## 3) Ver progresso rápido (contagem de erros)
```powershell
$err = Get-ChildItem .\logs\stress-errors-*.txt -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($err) {
  $errorCount = (Get-Content $err.FullName | Measure-Object -Line).Lines
  "Erros registrados até agora: $errorCount"
} else {
  "Erros registrados até agora: 0 (nenhum arquivo ainda)"
}
```

---

## 4) Ler o resultado final (JSON) com segurança

**IMPORTANTE:** não use wildcard direto no Get-Content, pegue o arquivo mais recente e use -Raw.

```powershell
$js = Get-ChildItem .\logs\stress-test-*.json -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($js) {
  $data = Get-Content $js.FullName -Raw | ConvertFrom-Json
  $data.statistics | Format-List
} else {
  "Ainda não existe stress-test-*.json final."
}
```

---

## 5) Estatísticas por endpoint (pós-teste)
```powershell
$js = Get-ChildItem .\logs\stress-test-*.json -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($js) {
  $data = Get-Content $js.FullName -Raw | ConvertFrom-Json
  $data.statistics.endpoints | Format-Table -AutoSize
} else {
  "Ainda não existe stress-test-*.json final."
}
```

---

## 6) Como parar o teste

### Se executado em foreground
- Pressione `Ctrl + C`

### Se executado em background (processo normal)
```powershell
$p = Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" |
  Where-Object { $_.CommandLine -like "*test-stress-load*" } |
  Select-Object -First 1

if ($p) {
  Stop-Process -Id $p.ProcessId -Force
  "Teste interrompido"
} else {
  "Não achei o processo."
}
```

### Se executado como Job
```powershell
Get-Job | Stop-Job -Force
```

---

## 7) Pulse check (sanidade do servidor sem depender dos logs)
```powershell
$base="https://bags-shield-api.vercel.app"

1..5 | ForEach-Object {
  $code = curl.exe -sS -o NUL -w "%{http_code}" "$base/api/health?ts=$(Get-Date -Format 'yyyyMMddHHmmss')"
  $t = Measure-Command {
    curl.exe -sS -o NUL -w "%{http_code}" "$base/api/health?ts=$(Get-Date -Format 'yyyyMMddHHmmss')" | Out-Null
  }
  "health: ${_}x code=$code time=$([math]::Round($t.TotalMilliseconds))ms"
  Start-Sleep -Seconds 2
}
```
