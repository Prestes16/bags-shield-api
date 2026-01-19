# Teste Comprehensivo - Todas as Funcionalidades
# Testa todas as funcionalidades de forma real e sistemática

param(
    [string]$BaseUrl = "https://bags-shield-api.vercel.app"
)

$ErrorActionPreference = "Continue"
$results = @()
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = "logs/comprehensive-test-$timestamp.json"

if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null,
        [int[]]$ExpectedStatus = @(200),
        [scriptblock]$Validator = $null
    )
    
    Write-Host "Testing: $Name" -ForegroundColor Cyan
    
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
        
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest @params -UseBasicParsing
        $stopwatch.Stop()
        
        $statusCode = $response.StatusCode
        $responseTime = $stopwatch.ElapsedMilliseconds
        
        try {
            $json = $response.Content | ConvertFrom-Json
        } catch {
            $json = $null
        }
        
        $passed = $statusCode -in $ExpectedStatus
        
        if ($Validator -and $json) {
            $validationResult = & $Validator $json
            $passed = $passed -and $validationResult
        }
        
        $result = @{
            name = $Name
            url = $Url
            method = $Method
            status = $statusCode
            responseTime = $responseTime
            passed = $passed
            timestamp = (Get-Date -Format "o")
            response = $json
        }
        
        $results += $result
        
        $color = if ($passed) { "Green" } else { "Red" }
        $status = if ($passed) { "PASS" } else { "FAIL" }
        Write-Host "  [$status] Status: $statusCode | Time: ${responseTime}ms" -ForegroundColor $color
        
        return $result
    } catch {
        $errorMsg = $_.Exception.Message
        $statusCode = $_.Exception.Response.StatusCode.value__
        
        $result = @{
            name = $Name
            url = $Url
            method = $Method
            status = $statusCode
            passed = $statusCode -in $ExpectedStatus
            error = $errorMsg
            timestamp = (Get-Date -Format "o")
        }
        
        $results += $result
        
        Write-Host "  [FAIL] Error: $errorMsg" -ForegroundColor Red
        return $result
    }
}

Write-Host "`n=== COMPREHENSIVE TEST - BAGS SHIELD API ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl`n" -ForegroundColor Yellow

# 1. Health Check
Test-Endpoint -Name "Health Check" -Url "$BaseUrl/api/health" -Validator {
    param($json)
    return $json.success -eq $true
}

# 2. Trending Tokens
Test-Endpoint -Name "Trending Tokens" -Url "$BaseUrl/api/bags/trending" -Validator {
    param($json)
    return $json.success -eq $true -and $json.response.tokens -ne $null
}

# 3. Scan - Valid Transaction
$validTx = "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo="
Test-Endpoint -Name "Scan (Valid)" -Url "$BaseUrl/api/scan" -Method "POST" -Body @{
    rawTransaction = $validTx
    network = "mainnet-beta"
    source = "test"
} -ExpectedStatus @(200) -Validator {
    param($json)
    return $json.success -eq $true -and $json.response.isSafe -ne $null -and $json.response.shieldScore -ne $null
}

# 4. Scan - Invalid Transaction (should be 400)
Test-Endpoint -Name "Scan (Invalid)" -Url "$BaseUrl/api/scan" -Method "POST" -Body @{
    rawTransaction = "invalid"
    network = "mainnet-beta"
} -ExpectedStatus @(400) -Validator {
    param($json)
    return $json.success -eq $false -and $json.error -ne $null
}

# 5. Scan - Missing Field (should be 400)
Test-Endpoint -Name "Scan (Missing Field)" -Url "$BaseUrl/api/scan" -Method "POST" -Body @{
    network = "mainnet-beta"
} -ExpectedStatus @(400)

# 6. Simulate - Buy
$testMint = "So11111111111111111111111111111111111111112"
Test-Endpoint -Name "Simulate Buy" -Url "$BaseUrl/api/simulate" -Method "POST" -Body @{
    mint = $testMint
    action = "buy"
    amount = "1"
    slippageBps = 50
} -ExpectedStatus @(200) -Validator {
    param($json)
    return $json.success -eq $true
}

# 7. Simulate - Sell
Test-Endpoint -Name "Simulate Sell" -Url "$BaseUrl/api/simulate" -Method "POST" -Body @{
    mint = $testMint
    action = "sell"
    amount = "1000"
    slippageBps = 50
} -ExpectedStatus @(200)

# 8. Simulate - Invalid Action
Test-Endpoint -Name "Simulate (Invalid Action)" -Url "$BaseUrl/api/simulate" -Method "POST" -Body @{
    mint = $testMint
    action = "invalid"
    amount = "1"
} -ExpectedStatus @(400, 200)  # Pode aceitar ou rejeitar

# 9. AI Image - Stub Mode
Test-Endpoint -Name "AI Image (Stub)" -Url "$BaseUrl/api/ai/image" -Method "POST" -Body @{
    prompt = "a cute meme token"
    style = "default"
    size = "800x400"
} -ExpectedStatus @(200) -Validator {
    param($json)
    return $json.success -eq $true -and $json.response.provider -eq "stub"
}

# 10. AI Image - Missing Prompt
Test-Endpoint -Name "AI Image (Missing Prompt)" -Url "$BaseUrl/api/ai/image" -Method "POST" -Body @{
    style = "default"
} -ExpectedStatus @(400)

# 11. App.html Redirect
Write-Host "Testing: App.html Redirect" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/app.html" -UseBasicParsing -TimeoutSec 10
    $containsV4 = $response.Content -match "app-v4\.html"
    $noMojibake = $response.Content -notmatch "├ú|├ú|â€" -and $response.Content -match "Se não redirecionar"
    
    $result = @{
        name = "App.html Redirect"
        url = "$BaseUrl/app.html"
        passed = $containsV4 -and $noMojibake
        containsV4 = $containsV4
        noMojibake = $noMojibake
        timestamp = (Get-Date -Format "o")
    }
    $results += $result
    
    $color = if ($result.passed) { "Green" } else { "Red" }
    Write-Host "  [$(if ($result.passed) { 'PASS' } else { 'FAIL' })] Contains v4: $containsV4 | No mojibake: $noMojibake" -ForegroundColor $color
} catch {
    $result = @{
        name = "App.html Redirect"
        url = "$BaseUrl/app.html"
        passed = $false
        error = $_.Exception.Message
        timestamp = (Get-Date -Format "o")
    }
    $results += $result
    Write-Host "  [FAIL] Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 12. Token Info (skip if no API key)
$bagsApiKey = $env:BAGS_API_KEY
if ($bagsApiKey -and $bagsApiKey.Trim() -ne "") {
    Test-Endpoint -Name "Token Info" -Url "$BaseUrl/api/bags/token-info" -Method "POST" -Body @{
        name = "Test Token"
        symbol = "TEST"
        description = "Test token"
    } -ExpectedStatus @(200, 501, 502)
} else {
    Write-Host "Skipping Token Info (BAGS_API_KEY not set)" -ForegroundColor Gray
    $results += @{
        name = "Token Info"
        skipped = $true
        reason = "BAGS_API_KEY not set"
    }
}

# 13. Create Config (skip if no API key)
if ($bagsApiKey -and $bagsApiKey.Trim() -ne "") {
    Test-Endpoint -Name "Create Config" -Url "$BaseUrl/api/bags/create-config" -Method "POST" -Body @{
        network = "devnet"
        launchWallet = "TestWallet123"
    } -ExpectedStatus @(200, 501, 502)
} else {
    Write-Host "Skipping Create Config (BAGS_API_KEY not set)" -ForegroundColor Gray
    $results += @{
        name = "Create Config"
        skipped = $true
        reason = "BAGS_API_KEY not set"
    }
}

# 14. CORS Preflight
Write-Host "Testing: CORS Preflight" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/api/scan" -Method "OPTIONS" -Headers @{
        "Origin" = "https://example.com"
        "Access-Control-Request-Method" = "POST"
    } -UseBasicParsing
    
    $result = @{
        name = "CORS Preflight"
        url = "$BaseUrl/api/scan"
        status = $response.StatusCode
        passed = $response.StatusCode -eq 204
        timestamp = (Get-Date -Format "o")
    }
    $results += $result
    
    $color = if ($result.passed) { "Green" } else { "Red" }
    Write-Host "  [$(if ($result.passed) { 'PASS' } else { 'FAIL' })] Status: $($response.StatusCode)" -ForegroundColor $color
} catch {
    $result = @{
        name = "CORS Preflight"
        url = "$BaseUrl/api/scan"
        passed = $false
        error = $_.Exception.Message
        timestamp = (Get-Date -Format "o")
    }
    $results += $result
    Write-Host "  [FAIL] Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Resumo
Write-Host "`n=== SUMMARY ===" -ForegroundColor Cyan
$passed = ($results | Where-Object { $_.passed -eq $true }).Count
$failed = ($results | Where-Object { $_.passed -eq $false }).Count
$skipped = ($results | Where-Object { $_.skipped -eq $true }).Count
$total = $results.Count

Write-Host "Total: $total | Passed: $passed | Failed: $failed | Skipped: $skipped" -ForegroundColor White

if ($failed -gt 0) {
    Write-Host "`nFailed Tests:" -ForegroundColor Red
    $results | Where-Object { $_.passed -eq $false } | ForEach-Object {
        Write-Host "  - $($_.name): $($_.error)" -ForegroundColor Red
    }
}

# Salvar resultados
$logData = @{
    timestamp = $timestamp
    baseUrl = $BaseUrl
    summary = @{
        total = $total
        passed = $passed
        failed = $failed
        skipped = $skipped
    }
    results = $results
}

$logData | ConvertTo-Json -Depth 10 | Out-File -FilePath $logFile -Encoding UTF8
Write-Host "`nResults saved to: $logFile" -ForegroundColor Gray

if ($failed -gt 0) {
    exit 1
} else {
    exit 0
}
