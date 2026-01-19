# Script Principal para Testes Intensivos
# Executa bateria completa de testes de forma intensiva

param(
    [string]$BaseUrl = "https://bags-shield-api.vercel.app",
    [int]$Iterations = 100,
    [int]$DelaySeconds = 2
)

$ErrorActionPreference = "Continue"
$startTime = Get-Date
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = "logs/intensive-run-$timestamp.json"

if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}

$allResults = @()
$testTx = "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo="
$testMint = "So11111111111111111111111111111111111111112"

function Invoke-QuickTest {
    param([string]$Name, [string]$Url, [string]$Method = "GET", [object]$Body = $null)
    
    try {
        $headers = @{ "Content-Type" = "application/json"; "Accept" = "application/json" }
        $params = @{ Uri = $Url; Method = $Method; Headers = $headers; TimeoutSec = 15; ErrorAction = "Stop" }
        if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress) }
        
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest @params -UseBasicParsing
        $sw.Stop()
        
        $json = $response.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
        return @{ success = $true; status = $response.StatusCode; time = $sw.ElapsedMilliseconds; name = $Name }
    } catch {
        return @{ success = $false; error = $_.Exception.Message; name = $Name }
    }
}

Write-Host "`n=== TESTE INTENSIVO - $Iterations ITERAÇÕES ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Yellow
Write-Host "Delay entre iterações: $DelaySeconds segundos`n" -ForegroundColor Yellow

for ($i = 1; $i -le $Iterations; $i++) {
    Write-Host "[$i/$Iterations] Executando bateria de testes..." -ForegroundColor White
    
    $batchResults = @()
    
    # Health
    $batchResults += Invoke-QuickTest -Name "health" -Url "$BaseUrl/api/health"
    
    # Trending
    $batchResults += Invoke-QuickTest -Name "trending" -Url "$BaseUrl/api/bags/trending"
    
    # Scan valid
    $batchResults += Invoke-QuickTest -Name "scan_valid" -Url "$BaseUrl/api/scan" -Method "POST" -Body @{
        rawTransaction = $testTx
        network = "mainnet-beta"
    }
    
    # Scan invalid
    $batchResults += Invoke-QuickTest -Name "scan_invalid" -Url "$BaseUrl/api/scan" -Method "POST" -Body @{
        rawTransaction = "invalid_$(Get-Random)"
        network = "mainnet-beta"
    }
    
    # Simulate buy
    $batchResults += Invoke-QuickTest -Name "simulate_buy" -Url "$BaseUrl/api/simulate" -Method "POST" -Body @{
        mint = $testMint
        action = "buy"
        amount = "1"
        slippageBps = 50
    }
    
    # Simulate sell
    $batchResults += Invoke-QuickTest -Name "simulate_sell" -Url "$BaseUrl/api/simulate" -Method "POST" -Body @{
        mint = $testMint
        action = "sell"
        amount = "1000"
        slippageBps = 50
    }
    
    # AI Image
    $batchResults += Invoke-QuickTest -Name "ai_image" -Url "$BaseUrl/api/ai/image" -Method "POST" -Body @{
        prompt = "test $(Get-Random)"
    }
    
    $allResults += $batchResults
    
    $success = ($batchResults | Where-Object { $_.success -eq $true }).Count
    $failed = ($batchResults | Where-Object { $_.success -eq $false }).Count
    
    Write-Host "  Resultado: $success sucesso, $failed falhas" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
    
    if ($i -lt $Iterations) {
        Start-Sleep -Seconds $DelaySeconds
    }
}

# Estatísticas finais
$total = $allResults.Count
$totalSuccess = ($allResults | Where-Object { $_.success -eq $true }).Count
$totalFailed = ($allResults | Where-Object { $_.success -eq $false }).Count

Write-Host "`n=== RESULTADO FINAL ===" -ForegroundColor Cyan
Write-Host "Total de requisições: $total" -ForegroundColor White
Write-Host "Sucesso: $totalSuccess ($([math]::Round($totalSuccess/$total*100, 2))%)" -ForegroundColor Green
Write-Host "Falhas: $totalFailed ($([math]::Round($totalFailed/$total*100, 2))%)" -ForegroundColor $(if ($totalFailed -gt 0) { "Red" } else { "Green" })

# Agrupar por endpoint
$byEndpoint = $allResults | Group-Object -Property name
Write-Host "`n=== POR ENDPOINT ===" -ForegroundColor Cyan
foreach ($group in $byEndpoint) {
    $epSuccess = ($group.Group | Where-Object { $_.success -eq $true }).Count
    $epFailed = ($group.Group | Where-Object { $_.success -eq $false }).Count
    $epRate = [math]::Round($epSuccess / $group.Count * 100, 2)
    Write-Host "$($group.Name): $epSuccess/$($group.Count) ($epRate%)" -ForegroundColor $(if ($epFailed -eq 0) { "Green" } else { "Yellow" })
}

# Salvar resultados
$logData = @{
    timestamp = $timestamp
    baseUrl = $BaseUrl
    iterations = $Iterations
    duration = ((Get-Date) - $startTime).TotalMinutes
    summary = @{
        total = $total
        success = $totalSuccess
        failed = $totalFailed
    }
    results = $allResults
}

$logData | ConvertTo-Json -Depth 10 | Out-File -FilePath $logFile -Encoding UTF8
Write-Host "`nResultados salvos em: $logFile" -ForegroundColor Gray
