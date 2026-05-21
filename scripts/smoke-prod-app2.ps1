param(
  [string]$BaseUrl = $env:BAGS_SHIELD_API_BASE,
  [switch]$IncludePaywallProbe
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  $BaseUrl = "https://api.bagsshield.org"
}

$BaseUrl = $BaseUrl.TrimEnd("/")
$SolMint = "So11111111111111111111111111111111111111112"
$UsdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
$SmokeWallet = if ($env:BAGS_SHIELD_SMOKE_WALLET) {
  $env:BAGS_SHIELD_SMOKE_WALLET
} else {
  "7ZybPucnSryE5BydcARdc4Q2gz1SaospMVRyQ2LCeyRi"
}

function Redact-Text {
  param([string]$Value)
  if ($null -eq $Value) { return "" }
  return $Value `
    -replace "api-key=[^&\s""]+", "api-key=REDACTED" `
    -replace "key=[^&\s""]+", "key=REDACTED" `
    -replace "Bearer\s+[\w\.-]+", "Bearer REDACTED" `
    -replace "x-api-key[:=]\s*[\w\.-]+", "x-api-key=REDACTED"
}

function Read-ErrorResponseContent {
  param($Exception)
  if ($Exception.Response -and $Exception.Response.GetResponseStream()) {
    $reader = New-Object System.IO.StreamReader($Exception.Response.GetResponseStream())
    try {
      return $reader.ReadToEnd()
    } finally {
      $reader.Dispose()
    }
  }
  return ""
}

function Invoke-SmokeRequest {
  param(
    [string]$Name,
    [string]$Method,
    [string]$Path,
    [object]$Body = $null,
    [int]$TimeoutSec = 30
  )

  $uri = "$BaseUrl$Path"
  $headers = @{ Accept = "application/json" }
  $content = ""
  $statusCode = 0
  $requestId = $null
  $json = $null

  try {
    $args = @{
      Uri             = $uri
      Method          = $Method
      Headers         = $headers
      UseBasicParsing = $true
      TimeoutSec      = $TimeoutSec
    }

    if ($null -ne $Body) {
      $args["ContentType"] = "application/json"
      $args["Body"] = ($Body | ConvertTo-Json -Depth 8 -Compress)
    }

    $response = Invoke-WebRequest @args
    $statusCode = [int]$response.StatusCode
    $content = [string]$response.Content
    $requestId = $response.Headers["X-Request-Id"]
  } catch {
    if ($_.Exception.Response) {
      $statusCode = [int]$_.Exception.Response.StatusCode
      $requestId = $_.Exception.Response.Headers["X-Request-Id"]
      $content = Read-ErrorResponseContent -Exception $_.Exception
    } else {
      $content = $_.Exception.Message
    }
  }

  try {
    if (-not [string]::IsNullOrWhiteSpace($content)) {
      $json = $content | ConvertFrom-Json
      if (-not $requestId -and $json.meta -and $json.meta.requestId) {
        $requestId = $json.meta.requestId
      }
    }
  } catch {
    $json = $null
  }

  $safeUri = Redact-Text $uri
  Write-Host ""
  Write-Host "[$Name] $Method $safeUri"
  Write-Host "  status=$statusCode requestId=$requestId"

  if ($json) {
    Write-Host "  success=$($json.success)"

    if ($Name -eq "quote") {
      $platformFee = $json.response.platformFeeBps
      if ($null -eq $platformFee -and $json.response.platformFee) {
        $platformFee = $json.response.platformFee.feeBps
      }
      Write-Host "  platformFeeBps=$platformFee"
      Write-Host "  inAmount=$($json.response.inAmount) outAmount=$($json.response.outAmount)"
    }

    if ($Name -eq "fee-quote") {
      Write-Host "  feeMode=$($json.response.feeMode)"
      Write-Host "  creatorBps=$($json.response.creatorFeeShareBps) bagsShieldBps=$($json.response.bagsShieldFeeShareBps)"
      Write-Host "  totalPlatformFeeLamports=$($json.response.totalPlatformFeeLamports)"
    }

    if ($Name -eq "scan") {
      $coverage = $json.meta.coverage
      $coverageLabel = $null
      if ($coverage) {
        $coverageLabel = $coverage.label
        if (-not $coverageLabel) {
          $ok = $coverage.enabledSourcesOk
          if ($null -eq $ok) { $ok = $coverage.sourcesOk }
          $total = $coverage.enabledSourcesTotal
          if ($null -eq $total) { $total = $coverage.sourcesTotal }
          if ($null -ne $ok -and $null -ne $total) {
            $coverageLabel = "$ok/$total enabled sources OK"
          }
        }
      }
      if (-not $coverageLabel -and $json.meta.sources) {
        $enabled = @()
        foreach ($source in $json.meta.sources) {
          $quality = @($source.quality)
          $disabled = $quality -contains "DISABLED" -or $quality -contains "SKIPPED_ECONOMY" -or "$($source.error)" -match "(?i)disabled|skipped"
          if (-not $disabled) { $enabled += $source }
        }
        $okCount = @($enabled | Where-Object { $_.ok -eq $true }).Count
        $coverageLabel = "$okCount/$($enabled.Count) enabled sources OK"
      }
      Write-Host "  badge=$($json.response.badge) score=$($json.response.score)"
      Write-Host "  coverage=$coverageLabel"
      if ($coverage.disabledSources) {
        foreach ($source in $coverage.disabledSources) {
          Write-Host "  disabledSource=$($source.name) reason=$($source.reason)"
        }
      } elseif ($json.meta.sources) {
        foreach ($source in $json.meta.sources) {
          $quality = @($source.quality)
          $disabled = $quality -contains "DISABLED" -or $quality -contains "SKIPPED_ECONOMY" -or "$($source.error)" -match "(?i)disabled|skipped"
          if ($disabled) {
            Write-Host "  disabledSource=$($source.name) reason=$($source.error)"
          }
        }
      }
      if ($json.integrity) {
        Write-Host "  integrity=present"
      }
    }

    if ($Name -like "paywall*") {
      $code = if ($json.error) { $json.error.code } else { "" }
      Write-Host "  paywall=$($json.paywall) code=$code"
    }
  } else {
    Write-Host "  response=$(Redact-Text $content)"
  }

  return [pscustomobject]@{
    Name      = $Name
    Status    = $statusCode
    RequestId = $requestId
    Json      = $json
  }
}

Write-Host "Bags Shield production smoke"
Write-Host "BaseUrl=$(Redact-Text $BaseUrl)"

$quotePath = "/api/quote?inputMint=$SolMint&outputMint=$UsdcMint&amount=1000000&slippageBps=50"
$quote = Invoke-SmokeRequest -Name "quote" -Method "GET" -Path $quotePath -TimeoutSec 30

$feeQuote = Invoke-SmokeRequest -Name "fee-quote" -Method "POST" -Path "/api/launchpad/fee-quote" -Body @{
  wallet = $SmokeWallet
  verified = $true
  initialBuyLamports = 0
  extraTipLamports = 0
} -TimeoutSec 20

$scan = Invoke-SmokeRequest -Name "scan" -Method "POST" -Path "/api/scan" -Body @{
  mint = $UsdcMint
} -TimeoutSec 35

if ($IncludePaywallProbe) {
  Write-Host ""
  Write-Host "Paywall probe enabled. This intentionally consumes free scan quota for the caller IP."
  for ($i = 1; $i -le 6; $i++) {
    $probe = Invoke-SmokeRequest -Name "paywall-$i" -Method "POST" -Path "/api/scan" -Body @{
      mint = $UsdcMint
    } -TimeoutSec 35
    if ($probe.Status -eq 402) { break }
  }
} else {
  Write-Host ""
  Write-Host "Paywall probe skipped. Run with -IncludePaywallProbe only when it is safe to consume free quota."
}
