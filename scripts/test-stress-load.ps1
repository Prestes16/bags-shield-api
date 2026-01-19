# Teste de Stress e Carga - Bags Shield API
# Simula uso intensivo por várias horas para detectar bugs, memory leaks, sobrecarga

param(
    [string]$BaseUrl = "https://bags-shield-api.vercel.app",
    [int]$DurationHours = 7,
    [int]$RequestsPerMinute = 60,
    [switch]$RealCalls = $true
)

$ErrorActionPreference = "Continue"
$startTime = Get-Date
$endTime = $startTime.AddHours($DurationHours)
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = "logs/stress-test-$timestamp.json"
$errorLogFile = "logs/stress-errors-$timestamp.txt"

# Criar diretório de logs
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}

$stats = @{
    totalRequests = 0
    successful = 0
    failed = 0
    errors = @()
    endpoints = @{}
    startTime = $startTime
    endTime = $endTime
}

$testTx = "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo="
$testMint = "So11111111111111111111111111111111111111112"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $time = Get-Date -Format "HH:mm:ss"
    $logMsg = "[$time] [$Level] $Message"
    Write-Host $logMsg
    Add-Content -Path $errorLogFile -Value $logMsg -ErrorAction SilentlyContinue
}

function Invoke-StressRequest {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null
    )
    
    $stats.totalRequests++
    if (-not $stats.endpoints.ContainsKey($Name)) {
        $stats.endpoints[$Name] = @{ total = 0; success = 0; failed = 0; avgTime = 0; times = @() }
    }
    $stats.endpoints[$Name].total++
    
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
            "Accept" = "application/json"
        }
        
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $headers
            TimeoutSec = 30
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
        }
        
        $response = Invoke-WebRequest @params -UseBasicParsing
        $stopwatch.Stop()
        $elapsed = $stopwatch.ElapsedMilliseconds
        
        $stats.endpoints[$Name].times += $elapsed
        $stats.endpoints[$Name].success++
        $stats.successful++
        
        # Verificar se resposta é válida
        try {
            $json = $response.Content | ConvertFrom-Json
            if ($json.success -eq $false) {
                throw "API returned success=false: $($json.error)"
            }
        } catch {
            # Não é JSON ou não tem success field - pode ser OK para alguns endpoints
        }
        
        return @{ success = $true; status = $response.StatusCode; time = $elapsed }
    } catch {
        $stopwatch.Stop()
        $elapsed = $stopwatch.ElapsedMilliseconds
        $errorMsg = $_.Exception.Message
        
        $stats.endpoints[$Name].times += $elapsed
        $stats.endpoints[$Name].failed++
        $stats.failed++
        
        $errorObj = @{
            timestamp = Get-Date -Format "o"
            endpoint = $Name
            url = $Url
            error = $errorMsg
            time = $elapsed
        }
        $stats.errors += $errorObj
        
        Write-Log "FAILED: $Name - $errorMsg" "ERROR"
        
        return @{ success = $false; error = $errorMsg; time = $elapsed }
    }
}

function Test-AllEndpoints {
    Write-Log "=== BATCH TEST START ===" "INFO"
    
    # 1. Health Check
    Invoke-StressRequest -Name "health" -Url "$BaseUrl/api/health" | Out-Null
    
    # 2. Trending Tokens
    Invoke-StressRequest -Name "trending" -Url "$BaseUrl/api/bags/trending" | Out-Null
    
    # 3. Scan Transaction (valid)
    Invoke-StressRequest -Name "scan_valid" -Url "$BaseUrl/api/scan" -Method "POST" -Body @{
        rawTransaction = $testTx
        network = "mainnet-beta"
    } | Out-Null
    
    # 4. Scan Transaction (invalid - should be 400)
    Invoke-StressRequest -Name "scan_invalid" -Url "$BaseUrl/api/scan" -Method "POST" -Body @{
        rawTransaction = "invalid_tx_$(Get-Random)"
        network = "mainnet-beta"
    } | Out-Null
    
    # 5. Simulate Buy
    Invoke-StressRequest -Name "simulate_buy" -Url "$BaseUrl/api/simulate" -Method "POST" -Body @{
        mint = $testMint
        action = "buy"
        amount = "1"
        slippageBps = 50
    } | Out-Null
    
    # 6. Simulate Sell
    Invoke-StressRequest -Name "simulate_sell" -Url "$BaseUrl/api/simulate" -Method "POST" -Body @{
        mint = $testMint
        action = "sell"
        amount = "1000"
        slippageBps = 50
    } | Out-Null
    
    # 7. AI Image (stub)
    Invoke-StressRequest -Name "ai_image" -Url "$BaseUrl/api/ai/image" -Method "POST" -Body @{
        prompt = "a cute meme token $(Get-Random)"
        style = "default"
        size = "800x400"
    } | Out-Null
    
    # 8. App.html redirect
    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl/app.html" -UseBasicParsing -TimeoutSec 10
        $containsV4 = $response.Content -match "app-v4\.html"
        $noMojibake = $response.Content -notmatch "├ú|├ú|â€"
        if (-not $containsV4 -or -not $noMojibake) {
            Write-Log "WARNING: app.html may have issues (v4: $containsV4, mojibake: $(-not $noMojibake))" "WARN"
        }
    } catch {
        Write-Log "ERROR: app.html check failed - $($_.Exception.Message)" "ERROR"
    }
    
    Write-Log "=== BATCH TEST END ===" "INFO"
}

function Show-Stats {
    $elapsed = (Get-Date) - $startTime
    $hours = [math]::Floor($elapsed.TotalHours)
    $minutes = [math]::Floor($elapsed.TotalMinutes % 60)
    
    Write-Host "`n=== STATISTICS (Elapsed: ${hours}h ${minutes}m) ===" -ForegroundColor Cyan
    Write-Host "Total Requests: $($stats.totalRequests)" -ForegroundColor White
    Write-Host "Successful: $($stats.successful) ($([math]::Round($stats.successful / $stats.totalRequests * 100, 2))%)" -ForegroundColor Green
    Write-Host "Failed: $($stats.failed) ($([math]::Round($stats.failed / $stats.totalRequests * 100, 2))%)" -ForegroundColor $(if ($stats.failed -gt 0) { "Red" } else { "Green" })
    Write-Host "Errors: $($stats.errors.Count)" -ForegroundColor $(if ($stats.errors.Count -gt 0) { "Yellow" } else { "Green" })
    
    Write-Host "`n=== ENDPOINT STATS ===" -ForegroundColor Cyan
    foreach ($endpoint in $stats.endpoints.Keys | Sort-Object) {
        $ep = $stats.endpoints[$endpoint]
        $successRate = if ($ep.total -gt 0) { [math]::Round($ep.success / $ep.total * 100, 2) } else { 0 }
        $avgTime = if ($ep.times.Count -gt 0) { [math]::Round(($ep.times | Measure-Object -Average).Average, 2) } else { 0 }
        $maxTime = if ($ep.times.Count -gt 0) { ($ep.times | Measure-Object -Maximum).Maximum } else { 0 }
        $minTime = if ($ep.times.Count -gt 0) { ($ep.times | Measure-Object -Minimum).Minimum } else { 0 }
        
        Write-Host "$endpoint :" -ForegroundColor White
        Write-Host "  Total: $($ep.total) | Success: $($ep.success) ($successRate%) | Failed: $($ep.failed)" -ForegroundColor Gray
        Write-Host "  Time: Avg ${avgTime}ms | Min ${minTime}ms | Max ${maxTime}ms" -ForegroundColor Gray
    }
}

function Save-Results {
    # Calcular médias de tempo
    foreach ($endpoint in $stats.endpoints.Keys) {
        $ep = $stats.endpoints[$endpoint]
        if ($ep.times.Count -gt 0) {
            $ep.avgTime = [math]::Round(($ep.times | Measure-Object -Average).Average, 2)
            $ep.minTime = ($ep.times | Measure-Object -Minimum).Minimum
            $ep.maxTime = ($ep.times | Measure-Object -Maximum).Maximum
            $ep.p95Time = if ($ep.times.Count -ge 20) {
                $sorted = $ep.times | Sort-Object
                $index = [math]::Floor($sorted.Count * 0.95)
                $sorted[$index]
            } else { $ep.maxTime }
        }
        # Remover array de times para economizar espaço
        $ep.Remove("times")
    }
    
    $results = @{
        testInfo = @{
            baseUrl = $BaseUrl
            durationHours = $DurationHours
            requestsPerMinute = $RequestsPerMinute
            startTime = $startTime.ToString("o")
            endTime = (Get-Date).ToString("o")
            actualDuration = ((Get-Date) - $startTime).TotalHours
        }
        statistics = $stats
    }
    
    $results | ConvertTo-Json -Depth 10 | Out-File -FilePath $logFile -Encoding UTF8
    Write-Log "Results saved to: $logFile" "INFO"
}

# Main loop
Write-Host "`n=== STRESS TEST STARTED ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Yellow
Write-Host "Duration: $DurationHours hours" -ForegroundColor Yellow
Write-Host "Target: ~$RequestsPerMinute requests/minute" -ForegroundColor Yellow
Write-Host "Logs: $logFile" -ForegroundColor Yellow
Write-Host "Errors: $errorLogFile" -ForegroundColor Yellow
Write-Host "`nPress Ctrl+C to stop early`n" -ForegroundColor Gray

$batchCount = 0
$requestsPerBatch = [math]::Max(1, [math]::Floor($RequestsPerMinute / 10))  # 10 batches per minute
$delayBetweenBatches = 6000  # 6 seconds = 10 batches per minute

try {
    while ((Get-Date) -lt $endTime) {
        $batchCount++
        Write-Log "Starting batch #$batchCount" "INFO"
        
        # Executar batch de testes
        for ($i = 0; $i -lt $requestsPerBatch; $i++) {
            Test-AllEndpoints
            Start-Sleep -Milliseconds ($delayBetweenBatches / $requestsPerBatch)
        }
        
        # Mostrar stats a cada 10 batches
        if ($batchCount % 10 -eq 0) {
            Show-Stats
        }
        
        # Verificar se ainda temos tempo
        if ((Get-Date) -ge $endTime) {
            break
        }
        
        # Pequena pausa entre batches principais
        Start-Sleep -Seconds 1
    }
} catch {
    Write-Log "Test interrupted: $($_.Exception.Message)" "ERROR"
} finally {
    Write-Host "`n=== STRESS TEST COMPLETED ===" -ForegroundColor Cyan
    Show-Stats
    Save-Results
    
    # Análise de problemas
    Write-Host "`n=== PROBLEM ANALYSIS ===" -ForegroundColor Cyan
    
    if ($stats.errors.Count -gt 0) {
        Write-Host "⚠️  Found $($stats.errors.Count) errors:" -ForegroundColor Yellow
        $errorGroups = $stats.errors | Group-Object -Property endpoint
        foreach ($group in $errorGroups) {
            Write-Host "  $($group.Name): $($group.Count) errors" -ForegroundColor Red
        }
    } else {
        Write-Host "✅ No errors detected!" -ForegroundColor Green
    }
    
    # Verificar performance degradation
    foreach ($endpoint in $stats.endpoints.Keys) {
        $ep = $stats.endpoints[$endpoint]
        if ($ep.maxTime -gt ($ep.avgTime * 3)) {
            Write-Host "⚠️  $endpoint : High variance in response times (max: $($ep.maxTime)ms vs avg: $($ep.avgTime)ms)" -ForegroundColor Yellow
        }
        if ($ep.avgTime -gt 5000) {
            Write-Host "⚠️  $endpoint : Slow average response time ($($ep.avgTime)ms)" -ForegroundColor Yellow
        }
    }
    
    Write-Host "`nFull results saved to: $logFile" -ForegroundColor Gray
    Write-Host "Error log saved to: $errorLogFile" -ForegroundColor Gray
}
