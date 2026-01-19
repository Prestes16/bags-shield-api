# Resumo - Testes Intensivos Implementados

**Data:** 2026-01-19

---

## ✅ Scripts Criados

### 1. `scripts/test-comprehensive.ps1`
**Função:** Teste completo e sistemático de todas as funcionalidades

**Testa:**
- ✅ Health check
- ✅ Trending tokens
- ✅ Scan (válido e inválido)
- ✅ Simulate (buy, sell, invalid)
- ✅ AI Image (stub e missing prompt)
- ✅ App.html redirect (sem mojibake)
- ✅ Token creation (se API key configurada)
- ✅ CORS preflight

**Uso:**
```powershell
.\scripts\test-comprehensive.ps1 -BaseUrl "https://bags-shield-api.vercel.app"
```

---

### 2. `scripts/test-intensive-run.ps1`
**Função:** Executa múltiplas iterações de testes básicos

**Características:**
- Executa N iterações (padrão: 100)
- Delay configurável entre iterações
- Estatísticas por endpoint
- Logs detalhados

**Uso:**
```powershell
# 100 iterações com 2s de delay
.\scripts\test-intensive-run.ps1 -Iterations 100 -DelaySeconds 2

# 1000 iterações para teste mais intensivo
.\scripts\test-intensive-run.ps1 -Iterations 1000 -DelaySeconds 1
```

---

### 3. `scripts/test-stress-load.ps1`
**Função:** Teste de stress e carga por 7 horas

**Características:**
- Duração configurável (padrão: 7 horas)
- Taxa de requisições configurável (padrão: 60/min)
- Monitora performance ao longo do tempo
- Detecta memory leaks
- Identifica degradação de performance
- Estatísticas detalhadas por endpoint
- Logs de erros separados

**Uso para 7 horas:**
```powershell
.\scripts\test-stress-load.ps1 -DurationHours 7 -RequestsPerMinute 60
```

**O que faz:**
- Executa batches de testes continuamente
- ~60 requisições por minuto
- ~25,200 requisições em 7 horas
- Mostra estatísticas a cada 10 batches
- Salva resultados completos ao final

---

## 📊 O Que os Testes Verificam

### Funcionalidade
- ✅ Todos os endpoints respondem corretamente
- ✅ Validação de input funciona (400 para inválido)
- ✅ Respostas têm formato JSON correto
- ✅ CORS funciona
- ✅ Redirects funcionam

### Performance
- ✅ Tempo de resposta (avg, min, max, p95)
- ✅ Degradação ao longo do tempo
- ✅ Variação de performance
- ✅ Timeouts

### Estabilidade
- ✅ Memory leaks
- ✅ Sobrecarga do servidor
- ✅ Taxa de erro
- ✅ Erros inesperados

### Segurança
- ✅ Validação de payload
- ✅ Rate limiting (se existir)
- ✅ CORS correto
- ✅ Sem stacktrace em produção

---

## 🚀 Como Executar Teste de 7 Horas

### Passo 1: Preparação
```powershell
cd C:\Dev\bags-shield-api

# Verificar se diretório logs existe
if (-not (Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" }
```

### Passo 2: Teste Rápido Primeiro
```powershell
# Teste completo uma vez
.\scripts\test-comprehensive.ps1

# Teste intensivo curto (10 iterações)
.\scripts\test-intensive-run.ps1 -Iterations 10 -DelaySeconds 1
```

### Passo 3: Executar Teste de 7 Horas
```powershell
# Executar teste de stress por 7 horas
.\scripts\test-stress-load.ps1 -DurationHours 7 -RequestsPerMinute 60
```

**Durante a execução:**
- O script mostra estatísticas a cada 10 batches
- Pode pressionar Ctrl+C para parar antecipadamente
- Logs são salvos automaticamente

### Passo 4: Analisar Resultados
```powershell
# Ver último log
Get-Content logs\stress-test-*.json | ConvertFrom-Json | Format-List

# Ver erros
Get-Content logs\stress-errors-*.txt

# Ver estatísticas resumidas
$data = Get-Content logs\stress-test-*.json | ConvertFrom-Json
$data.statistics | Format-List
```

---

## 📈 Exemplo de Saída Esperada

```
=== STRESS TEST STARTED ===
Base URL: https://bags-shield-api.vercel.app
Duration: 7 hours
Target: ~60 requests/minute

[1/10] Starting batch #1
=== BATCH TEST START ===
=== BATCH TEST END ===
...

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
  P95: 320ms
...
```

---

## 🔍 Problemas a Detectar

### Memory Leaks
- **Sintoma:** Tempo de resposta aumentando progressivamente
- **Verificar:** Comparar avg time inicial vs final
- **Ação:** Se aumento > 50%, investigar

### Sobrecarga
- **Sintoma:** Taxa de erro aumentando, timeouts frequentes
- **Verificar:** Taxa de sucesso ao longo do tempo
- **Ação:** Reduzir `-RequestsPerMinute` ou aumentar delay

### Bugs
- **Sintoma:** Erros inesperados, status codes incorretos
- **Verificar:** `logs/stress-errors-*.txt`
- **Ação:** Corrigir bugs identificados

### Performance Degradation
- **Sintoma:** P95 time muito alto, variação grande
- **Verificar:** Comparar min/max/avg times
- **Ação:** Otimizar endpoints problemáticos

---

## 📝 Logs Gerados

### Durante o Teste
- **Console:** Estatísticas em tempo real
- **stress-errors-*.txt:** Log de todos os erros

### Após o Teste
- **stress-test-*.json:** Estatísticas completas
  - Total de requisições
  - Taxa de sucesso/falha
  - Performance por endpoint
  - Todos os erros encontrados

---

## ⚠️ Recomendações

1. **Antes de 7 horas:**
   - Execute `test-comprehensive.ps1` primeiro
   - Execute `test-intensive-run.ps1` com poucas iterações
   - Verifique se não há erros críticos

2. **Durante:**
   - Monitore o console
   - Se muitos erros, pare e investigue
   - Verifique logs periodicamente

3. **Após:**
   - Analise `stress-test-*.json`
   - Compare performance inicial vs final
   - Verifique `stress-errors-*.txt` para bugs

---

## ✅ Status

- ✅ Scripts criados e prontos
- ✅ Documentação completa
- ✅ Testes podem ser executados imediatamente
- ✅ Logs e estatísticas detalhadas

**Próximo passo:** Executar `.\scripts\test-stress-load.ps1 -DurationHours 7` para teste completo de 7 horas.

---

**Criado em:** 2026-01-19
