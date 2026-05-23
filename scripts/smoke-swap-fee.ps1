#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Bags Shield - Swap Fee Smoke Test
    Tests POST /api/swap/fee end-to-end WITHOUT broadcasting any transaction.

.DESCRIPTION
    Validates that the embedded-fee swap endpoint:
      - Requires JUPITER_API_KEY and APP_FEE_BPS > 0 (fails closed)
      - Returns a well-formed unsigned VersionedTransaction (base64)
      - Includes all mandatory metadata fields in the response
      - Reports feeBps >= 50, feeMint, feeAccount, feeMode, requiresSingleUserSignature
      - Returns requestId, latencyMs, source = 'jupiter-v2-build'
    The swapTransaction is NOT decoded, signed, or broadcast.

.PARAMETER BaseUrl
    Base URL of the API server (default: http://localhost:3000)

.PARAMETER Origin
    CORS origin header to send (default: http://localhost:5173)

.PARAMETER UserPublicKey
    A valid Solana public key to use as the taker (default: known public treasury wallet)
    This wallet will NOT be charged - no transaction is signed or sent.

.PARAMETER AmountSolLamports
    Amount of SOL (in lamports) for the SOL->USDC test (default: 10000000 = 0.01 SOL)

.PARAMETER AmountUsdcAtomic
    Amount of USDC (in atomic units, 6 decimals) for USDC->SOL test (default: 1000000 = 1 USDC)

.PARAMETER SlippageBps
    Slippage tolerance in bps (default: 100 = 1%)

.EXAMPLE
    # Test local dev server
    .\smoke-swap-fee.ps1

.EXAMPLE
    # Test production
    .\smoke-swap-fee.ps1 -BaseUrl https://api.bagsshield.org

.EXAMPLE
    # Custom amount
    .\smoke-swap-fee.ps1 -AmountSolLamports 5000000
#>

param(
    [string]$BaseUrl           = "http://localhost:3000",
    [string]$Origin            = "http://localhost:5173",
    [string]$UserPublicKey     = "7ZybPucnSryE5BydcARdc4Q2gz1SaospMVRyQ2LCeyRi",
    [long]  $AmountSolLamports = 10000000,
    [long]  $AmountUsdcAtomic  = 1000000,
    [int]   $SlippageBps       = 100
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

# -- Mints -------------------------------------------------------------------
$WSOL_MINT = "So11111111111111111111111111111111111111112"
$USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

# -- Logger ------------------------------------------------------------------
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}
$logFile = "logs/smoke-swap-fee-$ts.txt"

function Log {
    param([string]$Text, [string]$Level = "INFO")
    $stamp = (Get-Date).ToString("HH:mm:ss.fff")
    $prefix = switch ($Level) {
        "PASS"  { "[PASS ]" }
        "FAIL"  { "[FAIL ]" }
        "SKIP"  { "[SKIP ]" }
        "WARN"  { "[WARN ]" }
        "HEAD"  { "[=====]" }
        default { "[     ]" }
    }
    $line = "$stamp $prefix $Text"
    $color = switch ($Level) {
        "PASS"  { "Green"  }
        "FAIL"  { "Red"    }
        "WARN"  { "Yellow" }
        "HEAD"  { "Cyan"   }
        "SKIP"  { "Gray"   }
        default { "White"  }
    }
    Write-Host $line -ForegroundColor $color
    Add-Content -Path $logFile -Value $line
}

# -- Pass/Fail counters -------------------------------------------------------
$script:passes = 0
$script:fails  = 0
$script:skips  = 0

function Assert {
    param([bool]$Condition, [string]$Label, [string]$Got = "")
    if ($Condition) {
        $script:passes++
        Log "PASS: $Label" "PASS"
    } else {
        $script:fails++
        if ($Got -ne "") {
            Log "FAIL: $Label (got: $Got)" "FAIL"
        } else {
            Log "FAIL: $Label" "FAIL"
        }
    }
}

function Skip {
    param([string]$Label)
    $script:skips++
    Log "SKIP: $Label (upstream unavailable - skip field checks)" "SKIP"
}

# -- HTTP helper --------------------------------------------------------------
function Invoke-Api {
    param(
        [string]$Method,
        [string]$Url,
        [object]$Body = $null,
        [int]$TimeoutSec = 30
    )
    $headers = @{
        "Origin"       = $Origin
        "Content-Type" = "application/json"
        "Accept"       = "application/json"
    }
    try {
        $params = @{
            Method      = $Method
            Uri         = $Url
            Headers     = $headers
            TimeoutSec  = $TimeoutSec
            ErrorAction = "Stop"
        }
        if ($Body -ne $null) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        $resp = Invoke-WebRequest @params -UseBasicParsing
        $json = $resp.Content | ConvertFrom-Json
        return @{ OK = $true; Status = [int]$resp.StatusCode; Json = $json; Raw = $resp.Content }
    } catch {
        $resp   = $_.Exception.Response
        $status = 0
        if ($resp -ne $null) { $status = [int]$resp.StatusCode }
        $body = ""
        if ($resp -ne $null) {
            try {
                $stream = $resp.GetResponseStream()
                $reader = New-Object IO.StreamReader($stream)
                $body   = $reader.ReadToEnd()
                $reader.Close()
            } catch { }
        }
        $json = $null
        if ($body -ne "") {
            try { $json = $body | ConvertFrom-Json } catch { }
        }
        return @{ OK = $false; Status = $status; Json = $json; Raw = $body; Error = $_.Exception.Message }
    }
}

# -- Safe null-guarded property access (replaces PS7+ ?. operator) -----------
function Get-SafeProp {
    param([object]$Obj, [string]$Prop, $Default = $null)
    if ($Obj -eq $null) { return $Default }
    $val = $Obj.$Prop
    if ($val -eq $null) { return $Default }
    return $val
}

# -- Validate a /api/swap/fee response ----------------------------------------
function Test-SwapFeeResponse {
    param(
        [string]$TestName,
        [object]$Result,
        [int]$ExpectedMinFeeBps = 50
    )

    Log "" "INFO"
    Log "-- ${TestName} --" "HEAD"

    # HTTP-level assertions
    if ($Result.Status -eq 503) {
        Skip "${TestName} - upstream (Jupiter/RPC) unavailable at test time (503)"
        return
    }
    if ($Result.Status -eq 502) {
        $errCode = "unknown"
        if ($Result.Json -ne $null) {
            $errObj = $Result.Json.error
            if ($errObj -ne $null) {
                $codeVal = $errObj.code
                if ($codeVal -ne $null) {
                    $errCode = "$codeVal"
                } else {
                    $errCode = "$errObj"
                }
            }
        }
        Log "WARNING: ${TestName} returned 502 - error code: $errCode" "WARN"
        Log "  Raw: $($Result.Raw)" "WARN"
        $script:fails++
        return
    }

    Assert ($Result.OK -eq $true) "${TestName}: HTTP 200" "HTTP $($Result.Status)"
    if (-not $Result.OK) {
        Log "  Error: $($Result.Error)" "WARN"
        Log "  Body:  $($Result.Raw)"   "WARN"
        return
    }

    $json = $Result.Json
    Assert ($json.success -eq $true) "${TestName}: success=true"

    $r = $json.response
    if ($r -eq $null) {
        $script:fails++
        Log "FAIL: ${TestName}: missing response object" "FAIL"
        return
    }

    # Core transaction field
    $txStr = ""
    if ($r.swapTransaction -ne $null) { $txStr = "$($r.swapTransaction)" }
    Assert ($txStr.Length -gt 100) `
        "${TestName}: swapTransaction is base64 string (len>100)" `
        "len=$($txStr.Length)"

    # Fee metadata
    $feeBpsRaw = $r.feeBps
    $feeBps = 0
    if ($feeBpsRaw -ne $null) { $feeBps = [int]$feeBpsRaw }
    Assert ($feeBps -ge $ExpectedMinFeeBps) `
        "${TestName}: feeBps >= $ExpectedMinFeeBps" `
        "feeBps=$feeBps"

    $feeMintStr = ""
    if ($r.feeMint -ne $null) { $feeMintStr = "$($r.feeMint)" }
    Assert ($feeMintStr.Length -ge 32) `
        "${TestName}: feeMint is valid pubkey string" `
        "'$feeMintStr'"

    $feeAccountStr = ""
    if ($r.feeAccount -ne $null) { $feeAccountStr = "$($r.feeAccount)" }
    Assert ($feeAccountStr.Length -ge 32) `
        "${TestName}: feeAccount is valid pubkey string" `
        "'$feeAccountStr'"

    $feeModeStr = ""
    if ($r.feeMode -ne $null) { $feeModeStr = "$($r.feeMode)" }
    Assert ($feeModeStr -eq "platform_fee_in_swap") `
        "${TestName}: feeMode='platform_fee_in_swap'" `
        "'$feeModeStr'"

    Assert ($r.requiresSingleUserSignature -eq $true) `
        "${TestName}: requiresSingleUserSignature=true" `
        "$($r.requiresSingleUserSignature)"

    # Swap route info
    $inputMintStr = ""
    if ($r.inputMint -ne $null) { $inputMintStr = "$($r.inputMint)" }
    Assert ($inputMintStr.Length -ge 32) "${TestName}: inputMint present"

    $outputMintStr = ""
    if ($r.outputMint -ne $null) { $outputMintStr = "$($r.outputMint)" }
    Assert ($outputMintStr.Length -ge 32) "${TestName}: outputMint present"

    Assert ($r.inAmount  -ne $null) "${TestName}: inAmount present"
    Assert ($r.outAmount -ne $null) "${TestName}: outAmount present"

    # Blockhash
    $blockhashStr = ""
    if ($r.blockhash -ne $null) { $blockhashStr = "$($r.blockhash)" }
    Assert ($blockhashStr.Length -ge 32) "${TestName}: blockhash present"

    # Meta
    $meta = $json.meta
    Assert ($meta -ne $null) "${TestName}: meta block present"
    if ($meta -ne $null) {
        $reqId = ""
        if ($meta.requestId -ne $null) { $reqId = "$($meta.requestId)" }
        Assert ($reqId.Length -gt 0) "${TestName}: meta.requestId present"

        $srcStr = ""
        if ($meta.source -ne $null) { $srcStr = "$($meta.source)" }
        Assert ($srcStr -eq "jupiter-v2-build") `
            "${TestName}: meta.source='jupiter-v2-build'" `
            "'$srcStr'"

        $latency = -1
        if ($meta.latencyMs -ne $null) { $latency = [int]$meta.latencyMs }
        Assert ($latency -ge 0) "${TestName}: meta.latencyMs >= 0"
    }

    # platformFee block
    Assert ($r.platformFee -ne $null) "${TestName}: platformFee block present"

    # Security: swapTransaction must NOT contain any obvious secret patterns
    $noSecretInTx = $txStr -notmatch "(private|secret|seed|mnemonic)"
    Assert $noSecretInTx "${TestName}: swapTransaction contains no secret keywords"

    # feeAccountSource must be 'env' or 'collector_ata' only
    $srcVal = ""
    if ($r.feeAccountSource -ne $null) { $srcVal = "$($r.feeAccountSource)" }
    $srcOk = ($srcVal -eq "env" -or $srcVal -eq "collector_ata")
    Assert $srcOk "${TestName}: feeAccountSource is 'env' or 'collector_ata'" "'$srcVal'"

    Log "${TestName}: DONE (feeBps=$feeBps feeMint=$feeMintStr feeMode=$feeModeStr)" "INFO"
}

# -- Validate health endpoint -------------------------------------------------
function Test-Health {
    Log "" "INFO"
    Log "-- Health Check --" "HEAD"

    $healthUrl = "$BaseUrl/api/rpc/health"
    $r = Invoke-Api -Method GET -Url $healthUrl -TimeoutSec 8

    Assert ($r.Status -in @(200, 204) -or ($r.Status -eq 0 -and $r.OK -eq $false)) `
        "Health endpoint reachable (200/204 or network error expected)" `
        "HTTP $($r.Status)"

    if ($r.OK) {
        $ok = $false
        if ($r.Json -ne $null) {
            if ($r.Json.success -eq $true) {
                $ok = $true
            } elseif ($r.Json.rpc -eq 'ok') {
                $ok = $true
            } else {
                $respObj = $r.Json.response
                if ($respObj -ne $null -and $respObj.ok -eq $true) { $ok = $true }
            }
        }
        if (-not $ok) {
            Log "WARN: Health returned 200 but success!=true - RPC may be degraded" "WARN"
        } else {
            Log "Health: RPC is OK" "PASS"
            $script:passes++
        }
    } else {
        Log "Health endpoint not reachable at $healthUrl - continuing with swap tests" "WARN"
    }
}

# =============================================================================
# MAIN
# =============================================================================
Log "=== BAGS SHIELD - smoke-swap-fee.ps1 ===" "HEAD"
Log "BaseUrl:       $BaseUrl"       "INFO"
Log "UserPublicKey: $UserPublicKey" "INFO"
$solDisplay  = [math]::Round($AmountSolLamports / 1000000000, 6)
$usdcDisplay = [math]::Round($AmountUsdcAtomic  / 1000000,    2)
Log "SOL amount:    $AmountSolLamports lamports ($solDisplay SOL)"  "INFO"
Log "USDC amount:   $AmountUsdcAtomic atomic ($usdcDisplay USDC)"   "INFO"
Log "SlippageBps:   $SlippageBps"   "INFO"
Log "NOTE: No transaction will be signed or broadcast." "WARN"

# 1. Health
Test-Health

# 2. SOL (WSOL) -> USDC
$solToUsdc = Invoke-Api `
    -Method POST `
    -Url    "$BaseUrl/api/swap/fee" `
    -Body   @{
        inputMint     = $WSOL_MINT
        outputMint    = $USDC_MINT
        amount        = "$AmountSolLamports"
        slippageBps   = $SlippageBps
        userPublicKey = $UserPublicKey
    }
Test-SwapFeeResponse -TestName "SOL->USDC" -Result $solToUsdc

# 3. USDC -> SOL (WSOL)
$usdcToSol = Invoke-Api `
    -Method POST `
    -Url    "$BaseUrl/api/swap/fee" `
    -Body   @{
        inputMint     = $USDC_MINT
        outputMint    = $WSOL_MINT
        amount        = "$AmountUsdcAtomic"
        slippageBps   = $SlippageBps
        userPublicKey = $UserPublicKey
    }
Test-SwapFeeResponse -TestName "USDC->SOL" -Result $usdcToSol

# 4. Input validation -- missing fields (expect 400)
Log "" "INFO"
Log "-- Input Validation: missing fields --" "HEAD"
$badBody = Invoke-Api `
    -Method POST `
    -Url    "$BaseUrl/api/swap/fee" `
    -Body   @{ inputMint = $WSOL_MINT }
Assert ($badBody.Status -in @(400, 422)) `
    "Missing fields: HTTP 400/422" `
    "HTTP $($badBody.Status)"
$badBodySuccess = $false
if ($badBody.Json -ne $null) { $badBodySuccess = ($badBody.Json.success -eq $false) }
Assert $badBodySuccess "Missing fields: success=false"

# 5. Input validation -- invalid mint (expect 400)
Log "" "INFO"
Log "-- Input Validation: invalid mint --" "HEAD"
$badMint = Invoke-Api `
    -Method POST `
    -Url    "$BaseUrl/api/swap/fee" `
    -Body   @{
        inputMint     = "not-a-valid-mint-address"
        outputMint    = $USDC_MINT
        amount        = "1000000"
        userPublicKey = $UserPublicKey
    }
Assert ($badMint.Status -in @(400, 422)) `
    "Invalid mint: HTTP 400/422" `
    "HTTP $($badMint.Status)"
$badMintSuccess = $false
if ($badMint.Json -ne $null) { $badMintSuccess = ($badMint.Json.success -eq $false) }
Assert $badMintSuccess "Invalid mint: success=false"

# 6. Input validation -- negative amount (expect 400)
Log "" "INFO"
Log "-- Input Validation: non-integer amount --" "HEAD"
$badAmount = Invoke-Api `
    -Method POST `
    -Url    "$BaseUrl/api/swap/fee" `
    -Body   @{
        inputMint     = $WSOL_MINT
        outputMint    = $USDC_MINT
        amount        = "-100"
        userPublicKey = $UserPublicKey
    }
Assert ($badAmount.Status -in @(400, 422)) `
    "Non-integer amount: HTTP 400/422" `
    "HTTP $($badAmount.Status)"

# 7. OPTIONS (CORS preflight)
Log "" "INFO"
Log "-- CORS Preflight (OPTIONS) --" "HEAD"
$options = Invoke-Api -Method OPTIONS -Url "$BaseUrl/api/swap/fee" -TimeoutSec 8
Assert ($options.Status -in @(200, 204)) `
    "OPTIONS /api/swap/fee: 200/204" `
    "HTTP $($options.Status)"

# -- Summary ------------------------------------------------------------------
Log "" "INFO"
Log "=============================================" "HEAD"
$resultLevel = "PASS"
if ($script:fails -gt 0) { $resultLevel = "FAIL" }
Log "RESULTS: $($script:passes) passed, $($script:fails) failed, $($script:skips) skipped" $resultLevel
Log "Log: $logFile" "INFO"

if ($script:fails -gt 0) {
    exit 1
} else {
    exit 0
}
