# Teste Completo de Integração - Bags Shield
# Testa: Health, Trending, Scan, Simulate, Buy/Sell com dados reais

param(
    [string]$BaseUrl = "https://bags-shield-api.vercel.app",
    [string]$Mint = "So11111111111111111111111111111111111111112",
    [string]$TestMint = ""
)

$ErrorActionPreference = "Continue"
$results = @()
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = "logs/test-integration-$timestamp.json"

# Criar diretório de logs se não existir
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}

function Write-TestResult {
    param([string]$TestName, [bool]$Passed, [string]$Message, [object]$Data = $null)
    $result = @{
        test = $TestName
        passed = $Passed
        message = $Message
        timestamp = (Get-Date -Format "o")
        data = $Data
    }
    $results += $result
    $color = if ($Passed) { "Green" } else { "Red" }
    $status = if ($Passed) { "PASS" } else { "FAIL" }
    Write-Host "[$status] $TestName" -ForegroundColor $color
    if ($Message) {
        Write-Host "  $Message" -ForegroundColor Gray
    }
}

function Invoke-ApiTest {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null,
        [int[]]$ExpectedStatus = @(200),
        [switch]$Allow400 = $false,
        [switch]$SaveRawOnError = $false
    )
    
    $rawResponse = $null
    $rawError = $null
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
            "Accept" = "application/json"
        }
        
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $headers
            TimeoutSec = 15
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        try {
            $response = Invoke-WebRequest @params -UseBasicParsing
            $statusCode = $response.StatusCode
            $rawResponse = $response.Content
            
            # Tentar parsear JSON, mas guardar raw se falhar
            $responseBody = $null
            try {
                $responseBody = $rawResponse | ConvertFrom-Json
            } catch {
                # Se não for JSON, guardar raw
                $rawError = $rawResponse
                Write-Warning "[$Name] Response não é JSON válido. Raw: $($rawResponse.Substring(0, [Math]::Min(200, $rawResponse.Length)))"
            }
            
            if ($statusCode -in $ExpectedStatus -or ($Allow400 -and $statusCode -eq 400)) {
                $passed = $true
                if ($statusCode -eq 400) {
                    $message = "Status: 400 (expected for invalid input)"
                } else {
                    $message = "Status: $statusCode"
                }
                $data = if ($responseBody) { $responseBody } else { @{ raw = $rawResponse } }
                Write-TestResult -TestName $Name -Passed $passed -Message $message -Data $data
                return $responseBody
            } else {
                $data = if ($responseBody) { $responseBody } else { @{ raw = $rawResponse } }
                Write-TestResult -TestName $Name -Passed $false -Message "Unexpected status: $statusCode (expected: $($ExpectedStatus -join ','))" -Data $data
                
                # Salvar raw se SaveRawOnError
                if ($SaveRawOnError -and $rawResponse) {
                    $errorFile = "logs/error-$Name-$timestamp.txt"
                    $rawResponse | Out-File -FilePath $errorFile -Encoding UTF8
                    Write-Host "  Erro raw salvo em: $errorFile" -ForegroundColor Yellow
                }
                
                return $null
            }
        } catch {
            $statusCode = $null
            $rawResponse = $null
            
            if ($_.Exception.Response) {
                $statusCode = $_.Exception.Response.StatusCode.value__
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $rawResponse = $reader.ReadToEnd()
            }
            
            # Tentar parsear JSON, mas guardar raw se falhar
            $responseBody = $null
            if ($rawResponse) {
                try {
                    $responseBody = $rawResponse | ConvertFrom-Json -ErrorAction SilentlyContinue
                } catch {
                    $rawError = $rawResponse
                }
            }
            
            if ($statusCode -and ($statusCode -in $ExpectedStatus -or ($Allow400 -and $statusCode -eq 400))) {
                $passed = $true
                $message = "Status: $statusCode (expected)"
                $data = if ($responseBody) { $responseBody } else { @{ raw = $rawResponse } }
                Write-TestResult -TestName $Name -Passed $passed -Message $message -Data $data
                return $responseBody
            } else {
                $data = if ($responseBody) { $responseBody } else { @{ raw = $rawResponse; error = $_.Exception.Message } }
                Write-TestResult -TestName $Name -Passed $false -Message "Error status: $statusCode" -Data $data
                
                # Salvar raw se SaveRawOnError
                if ($SaveRawOnError -and $rawResponse) {
                    $errorFile = "logs/error-$Name-$timestamp.txt"
                    $rawResponse | Out-File -FilePath $errorFile -Encoding UTF8
                    Write-Host "  Erro raw salvo em: $errorFile" -ForegroundColor Yellow
                }
                
                return $null
            }
        }
    } catch {
        $errorMsg = $_.Exception.Message
        Write-TestResult -TestName $Name -Passed $false -Message "Error: $errorMsg" -Data @{ error = $errorMsg; raw = $rawError }
        
        # Salvar raw se SaveRawOnError
        if ($SaveRawOnError -and $rawError) {
            $errorFile = "logs/error-$Name-$timestamp.txt"
            $rawError | Out-File -FilePath $errorFile -Encoding UTF8
            Write-Host "  Erro raw salvo em: $errorFile" -ForegroundColor Yellow
        }
        
        return $null
    }
}

Write-Host "`n=== TESTE COMPLETO DE INTEGRAÇÃO - BAGS SHIELD ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Yellow
Write-Host "Mint de teste: $Mint`n" -ForegroundColor Yellow

# 1. Health Check
Write-Host "1. Health Check..." -ForegroundColor White
$health = Invoke-ApiTest -Name "Health Check" -Url "$BaseUrl/api/health"
if ($health) {
    $TestMint = $Mint
}

# 2. Trending Tokens
Write-Host "`n2. Trending Tokens..." -ForegroundColor White
$trending = Invoke-ApiTest -Name "Trending Tokens" -Url "$BaseUrl/api/bags/trending" -SaveRawOnError
if ($trending -and $trending.response.tokens -and $trending.response.tokens.Count -gt 0) {
    $firstToken = $trending.response.tokens[0]
    if ($firstToken.mint) {
        $TestMint = $firstToken.mint
        Write-Host "  Usando mint do trending: $TestMint" -ForegroundColor Gray
    }
}

# 3. Simulate Buy
Write-Host "`n3. Simulate Buy..." -ForegroundColor White
$simulateBuy = Invoke-ApiTest -Name "Simulate Buy" -Url "$BaseUrl/api/simulate" -Method "POST" -Body @{
    mint = $TestMint
    action = "buy"
    amount = "1"
    slippageBps = 50
}

# 4. Simulate Sell
Write-Host "`n4. Simulate Sell..." -ForegroundColor White
$simulateSell = Invoke-ApiTest -Name "Simulate Sell" -Url "$BaseUrl/api/simulate" -Method "POST" -Body @{
    mint = $TestMint
    action = "sell"
    amount = "1000"
    slippageBps = 50
}

# 5. Scan Transaction (must be 200 or 400, never 404/500)
Write-Host "`n5. Scan Transaction..." -ForegroundColor White
# Base64 limpo e válido (sem caracteres fora do padrão)
$testTx = "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo="
$scan = Invoke-ApiTest -Name "Scan Transaction (valid)" -Url "$BaseUrl/api/scan" -Method "POST" -Body @{
    rawTransaction = $testTx
    network = "mainnet-beta"
} -ExpectedStatus @(200) -Allow400

# 5b. Scan Transaction (invalid - should be 400)
Write-Host "`n5b. Scan Transaction (invalid input)..." -ForegroundColor White
$scanInvalid = Invoke-ApiTest -Name "Scan Transaction (invalid)" -Url "$BaseUrl/api/scan" -Method "POST" -Body @{
    rawTransaction = "invalid"
    network = "mainnet-beta"
} -ExpectedStatus @(400)

# 6. App.html Redirect Check
Write-Host "`n6. App.html Redirect Check..." -ForegroundColor White
try {
    $appHtml = Invoke-WebRequest -Uri "$BaseUrl/app.html" -UseBasicParsing -TimeoutSec 10
    $containsV4 = $appHtml.Content -match "app-v4\.html"
    $noMojibake = $appHtml.Content -notmatch "├ú|├ú|â€" -and $appHtml.Content -match "Se não redirecionar"
    $passed = $containsV4 -and $noMojibake
    Write-TestResult -TestName "App.html Redirect" -Passed $passed -Message "Contains app-v4.html: $containsV4, No mojibake: $noMojibake" -Data @{ contentLength = $appHtml.Content.Length }
} catch {
    Write-TestResult -TestName "App.html Redirect" -Passed $false -Message "Error: $($_.Exception.Message)"
}

# 7. Token Creation (skip if BAGS_API_KEY not set)
Write-Host "`n7. Token Creation (skip if BAGS_API_KEY not set)..." -ForegroundColor White
$bagsApiKey = $env:BAGS_API_KEY
if (-not $bagsApiKey -or $bagsApiKey.Trim() -eq "") {
    Write-TestResult -TestName "Token Creation" -Passed $true -Message "SKIPPED: BAGS_API_KEY not set" -Data @{ skipped = $true }
} else {
    # Test token-info
    $tokenInfo = Invoke-ApiTest -Name "Token Info" -Url "$BaseUrl/api/bags/token-info" -Method "POST" -Body @{
        name = "Test Token"
        symbol = "TEST"
        description = "Test token for integration"
    }
}

# Resumo
Write-Host "`n=== RESUMO ===" -ForegroundColor Cyan
$passed = ($results | Where-Object { $_.passed -eq $true }).Count
$failed = ($results | Where-Object { $_.passed -eq $false }).Count
$total = $results.Count

Write-Host "Total: $total | Passou: $passed | Falhou: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })

# Salvar logs
$logData = @{
    timestamp = $timestamp
    baseUrl = $BaseUrl
    summary = @{
        total = $total
        passed = $passed
        failed = $failed
    }
    results = $results
}

$logData | ConvertTo-Json -Depth 10 | Out-File -FilePath $logFile -Encoding UTF8
Write-Host "`nLog salvo em: $logFile" -ForegroundColor Gray

if ($failed -gt 0) {
    exit 1
} else {
    exit 0
}
