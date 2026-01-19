# Guia de Testes Intensivos - Bags Shield API

Este documento descreve como executar testes intensivos para verificar bugs, sobrecarga e problemas de performance.

---

## 📋 Scripts Disponíveis

### 1. `test-comprehensive.ps1`
**Descrição:** Testa todas as funcionalidades de forma sistemática uma vez.

**Uso:**
```powershell
cd C:\Dev\bags-shield-api
.\scripts\test-comprehensive.ps1 -BaseUrl "https://bags-shield-api.vercel.app"
```

**O que testa:**
- Health check
- Trending tokens
- Scan (válido e inválido)
- Simulate (buy e sell)
- AI Image (stub)
- App.html redirect
- Token creation (se API key configurada)
- CORS preflight

**Resultado:** Gera `logs/comprehensive-test-YYYYMMDD-HHMMSS.json`

---

### 2. `test-intensive-run.ps1`
**Descrição:** Executa múltiplas iterações de testes básicos.

**Uso:**
```powershell
cd C:\Dev\bags-shield-api
.\scripts\test-intensive-run.ps1 -BaseUrl "https://bags-shield-api.vercel.app" -Iterations 100 -DelaySeconds 2
```

**Parâmetros:**
- `-Iterations`: Número de iterações (padrão: 100)
- `-DelaySeconds`: Delay entre iterações em segundos (padrão: 2)

**O que testa (por iteração):**
- Health check
- Trending tokens
- Scan (válido e inválido)
- Simulate (buy e sell)
- AI Image

**Resultado:** Gera `logs/intensive-run-YYYYMMDD-HHMMSS.json`

---

### 3. `test-stress-load.ps1`
**Descrição:** Teste de stress e carga por 7 horas simulando uso intensivo.

**Uso:**
```powershell
cd C:\Dev\bags-shield-api
.\scripts\test-stress-load.ps1 -BaseUrl "https://bags-shield-api.vercel.app" -DurationHours 7 -RequestsPerMinute 60
```

**Parâmetros:**
- `-DurationHours`: Duração em horas (padrão: 7)
- `-RequestsPerMinute`: Taxa de requisições por minuto (padrão: 60)
- `-RealCalls`: Usar chamadas reais (padrão: true)

**O que testa:**
- Executa batches de testes continuamente
- Monitora performance (tempo de resposta)
- Detecta memory leaks
- Identifica degradação de performance
- Registra todos os erros

**Resultado:** 
- `logs/stress-test-YYYYMMDD-HHMMSS.json` (estatísticas completas)
- `logs/stress-errors-YYYYMMDD-HHMMSS.txt` (log de erros)

---

## 🚀 Executando Teste de 7 Horas

### Opção 1: Execução Completa (Recomendado)
```powershell
cd C:\Dev\bags-shield-api

# Executar teste de stress por 7 horas
.\scripts\test-stress-load.ps1 -BaseUrl "https://bags-shield-api.vercel.app" -DurationHours 7 -RequestsPerMinute 60
```

**O que acontece:**
- Executa ~60 requisições por minuto
- Total: ~25,200 requisições em 7 horas
- Mostra estatísticas a cada 10 batches
- Salva resultados ao final

### Opção 2: Execução com Menos Carga (Teste Rápido)
```powershell
# Teste de 1 hora com 30 req/min
.\scripts\test-stress-load.ps1 -DurationHours 1 -RequestsPerMinute 30
```

### Opção 3: Execução em Background
```powershell
# Executar em background (Windows)
Start-Process powershell -ArgumentList "-File", ".\scripts\test-stress-load.ps1", "-DurationHours", "7" -WindowStyle Hidden
```

---

## 📊 Monitoramento Durante o Teste

O script mostra estatísticas a cada 10 batches:

```
=== STATISTICS (Elapsed: 2h 15m) ===
Total Requests: 8100
Successful: 8095 (99.94%)
Failed: 5 (0.06%)
Errors: 5

=== ENDPOINT STATS ===
health :
  Total: 1350 | Success: 1350 (100%) | Failed: 0
  Time: Avg 45ms | Min 32ms | Max 120ms
scan_valid :
  Total: 1350 | Success: 1348 (99.85%) | Failed: 2
  Time: Avg 180ms | Min 120ms | Max 450ms
...
```

---

## 🔍 Análise de Resultados

### Verificar Logs
```powershell
# Ver último log de stress test
Get-Content logs\stress-test-*.json | ConvertFrom-Json | Format-List

# Ver erros
Get-Content logs\stress-errors-*.txt
```

### Problemas a Verificar

1. **Memory Leaks:**
   - Tempo de resposta aumentando ao longo do tempo
   - Muitos timeouts

2. **Sobrecarga:**
   - Taxa de erro aumentando
   - Tempo de resposta degradando

3. **Bugs:**
   - Erros inesperados
   - Status codes incorretos
   - Respostas inválidas

4. **Performance:**
   - P95 time muito alto
   - Variação grande entre min/max

---

## ⚠️ Recomendações

1. **Antes de executar 7 horas:**
   - Execute `test-comprehensive.ps1` primeiro
   - Execute `test-intensive-run.ps1` com 10 iterações
   - Verifique se não há erros críticos

2. **Durante a execução:**
   - Monitore o console para erros
   - Verifique logs periodicamente
   - Se muitos erros, pare e investigue

3. **Após a execução:**
   - Analise `stress-test-*.json`
   - Verifique `stress-errors-*.txt`
   - Compare performance inicial vs final

---

## 📝 Exemplo de Execução Completa

```powershell
# 1. Teste rápido primeiro
.\scripts\test-comprehensive.ps1

# 2. Teste intensivo curto (10 iterações)
.\scripts\test-intensive-run.ps1 -Iterations 10

# 3. Se tudo OK, executar teste de 7 horas
.\scripts\test-stress-load.ps1 -DurationHours 7 -RequestsPerMinute 60

# 4. Após conclusão, analisar resultados
Get-Content logs\stress-test-*.json | ConvertFrom-Json | Select-Object -ExpandProperty statistics
```

---

## 🐛 Troubleshooting

### Script não executa
- Verificar se está no diretório correto: `cd C:\Dev\bags-shield-api`
- Verificar permissões do PowerShell

### Muitos erros/timeouts
- Reduzir `-RequestsPerMinute`
- Aumentar `-DelaySeconds` no intensive-run
- Verificar conectividade com a API

### Logs muito grandes
- Os logs são salvos em `logs/`
- Remover logs antigos periodicamente
- Considerar reduzir detalhes nos logs

---

**Última atualização:** 2026-01-19
