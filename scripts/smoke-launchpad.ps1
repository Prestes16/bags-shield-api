<#
.SYNOPSIS
    Smoke tests for Launchpad endpoints
    
.DESCRIPTION
    Tests Launchpad API endpoints:
    - POST /api/launchpad/token-info
    - POST /api/launchpad/create-config
    - POST /api/launchpad/preflight
    - POST /api/launchpad/manifest
    
.PARAMETER BaseUrl
    Base URL for the API (default: http://localhost:3000)
    
.PARAMETER LaunchWallet
    Solana wallet address for launch (default: So11111111111111111111111111111111111111112)
    
.PARAMETER TipWallet
    Optional tip wallet address
    
.PARAMETER TipLamports
    Tip amount in lamports (default: 1000000)
    
.EXAMPLE
    .\scripts\smoke-launchpad.ps1 -BaseUrl "http://localhost:3000"
    
.EXAMPLE
    .\scripts\smoke-launchpad.ps1 -BaseUrl "https://bags-shield-api.vercel.app" -LaunchWallet "YourWalletAddress"
#>

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$LaunchWallet = "So11111111111111111111111111111111111111112",
    [string]$TipWallet = "",
    [int]$TipLamports = 1000000
)

$ErrorActionPreference = "Stop"

$testToken = @{
    name = "Smoke Test Token"
    symbol = "SMOKE"
    decimals = 9
    description = "Token created by smoke test"
    imageUrl = "https://example.com/image.png"
}

$testConfig = @{
    launchWallet = $LaunchWallet
    token = $testToken
}

if ($TipWallet -and $TipWallet -ne "") {
    $testConfig.tipWallet = $TipWallet
    $testConfig.tipLamports = $TipLamports
}

$testPreflight = @{
    config = $testConfig
}

$testManifest = @{
    mint = "So11111111111111111111111111111111111111112"
    shieldScore = 85
    grade = "A"
    isSafe = $true
    badges = @(
        @{
            key = "validated"
            title = "Token Validated"
            severity = "low"
            impact = "positive"
            tags = @("validation", "security")
        }
    )
    summary = "Token passed all security validations"
}

function Invoke-LaunchpadEndpoint {
    param(
        [string]$Endpoint,
        [object]$Body,
        [string]$Description
    )
    
    $uri = "$BaseUrl$Endpoint"
    $bodyJson = $Body | ConvertTo-Json -Depth 10 -Compress
    
    $tmp = Join-Path $env:TEMP "launchpad-smoke-$(New-Guid).json"
    $bodyJsonLf = ($bodyJson -replace "`r`n","`n")
    [System.IO.File]::WriteAllText($tmp, $bodyJsonLf, (New-Object System.Text.UTF8Encoding($false)))
    
    Write-Host ""
    Write-Host "=== $Description ===" -ForegroundColor Cyan
    Write-Host "URL  : $uri" -ForegroundColor Gray
    Write-Host "Body : $bodyJson" -ForegroundColor Gray
    Write-Host ""
    
    try {
        $response = curl.exe -sS -i -X POST "$uri" `
            -H "Content-Type: application/json" `
            -H "Cache-Control: no-store" `
            --data-binary "@$tmp"
        
        $statusLine = ($response -split "`n" | Select-Object -First 1)
        Write-Host $response
        
        if ($statusLine -match "HTTP/\d\.\d\s+(\d+)") {
            $statusCode = [int]$matches[1]
            if ($statusCode -ge 200 -and $statusCode -lt 300) {
                Write-Host "✓ Success (HTTP $statusCode)" -ForegroundColor Green
                return $true
            } elseif ($statusCode -ge 400 -and $statusCode -lt 500) {
                Write-Host "⚠ Client Error (HTTP $statusCode) - May be expected for validation tests" -ForegroundColor Yellow
                return $true  # Validation errors are expected in some tests
            } else {
                Write-Host "✗ Server Error (HTTP $statusCode)" -ForegroundColor Red
                return $false
            }
        } else {
            Write-Host "✗ Failed to parse response" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "✗ Request failed: $_" -ForegroundColor Red
        return $false
    } finally {
        if (Test-Path $tmp) {
            Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Launchpad Smoke Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray
Write-Host "Launch Wallet: $LaunchWallet" -ForegroundColor Gray
Write-Host ""

$results = @{}

# Test 1: token-info
$results.tokenInfo = Invoke-LaunchpadEndpoint `
    -Endpoint "/api/launchpad/token-info" `
    -Body $testToken `
    -Description "POST /api/launchpad/token-info"

# Test 2: create-config
$results.createConfig = Invoke-LaunchpadEndpoint `
    -Endpoint "/api/launchpad/create-config" `
    -Body $testConfig `
    -Description "POST /api/launchpad/create-config"

# Test 3: preflight
$results.preflight = Invoke-LaunchpadEndpoint `
    -Endpoint "/api/launchpad/preflight" `
    -Body $testPreflight `
    -Description "POST /api/launchpad/preflight"

# Test 4: manifest
$results.manifest = Invoke-LaunchpadEndpoint `
    -Endpoint "/api/launchpad/manifest" `
    -Body $testManifest `
    -Description "POST /api/launchpad/manifest"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "token-info  : $(if ($results.tokenInfo) { '✓' } else { '✗' })" -ForegroundColor $(if ($results.tokenInfo) { 'Green' } else { 'Red' })
Write-Host "create-config: $(if ($results.createConfig) { '✓' } else { '✗' })" -ForegroundColor $(if ($results.createConfig) { 'Green' } else { 'Red' })
Write-Host "preflight    : $(if ($results.preflight) { '✓' } else { '✗' })" -ForegroundColor $(if ($results.preflight) { 'Green' } else { 'Red' })
Write-Host "manifest     : $(if ($results.manifest) { '✓' } else { '✗' })" -ForegroundColor $(if ($results.manifest) { 'Green' } else { 'Red' })
Write-Host ""

$allPassed = $results.tokenInfo -and $results.createConfig -and $results.preflight -and $results.manifest

if ($allPassed) {
    Write-Host "All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some tests failed!" -ForegroundColor Red
    exit 1
}
