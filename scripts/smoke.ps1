param(
  [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "== Smoke test Bags Shield ==" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl`n"

function Invoke-Json {
  param(
    [Parameter(Mandatory)][ValidateSet("GET","POST")][string]$Method,
    [Parameter(Mandatory)][string]$Url,
    [string]$RawBody
  )
  $code = $null
  $raw  = $null
  try {
    if ($Method -eq "GET") {
      $resp = Invoke-WebRequest -Uri $Url -Method GET -Headers @{Accept="application/json"}
    } else {
      $resp = Invoke-WebRequest -Uri $Url -Method POST -Headers @{ "Content-Type" = "application/json" } -Body $RawBody
    }
    $code = $resp.StatusCode
    $raw  = $resp.Content
  } catch {
    $resp2 = $_.Exception.Response
    if ($resp2 -ne $null) {
      $code = [int]$resp2.StatusCode
      $stream = $resp2.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $raw = $reader.ReadToEnd()
    } else {
      $code = -1
      $raw = $_.Exception.Message
    }
  }
  try {
    $json = $raw | ConvertFrom-Json | ConvertTo-Json -Depth 8
  } catch {
    $json = $raw
  }
  return [PSCustomObject]@{ Code = $code; Body = $json }
}

function Test-Req {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][ValidateSet("GET","POST")][string]$Method,
    [Parameter(Mandatory)][string]$Path,
    [hashtable]$BodyObj
  )
  $url = "$BaseUrl$Path"
  $rawBody = $null
  if ($Method -eq "POST" -and $BodyObj) { $rawBody = ($BodyObj | ConvertTo-Json -Depth 8) }
  $res = Invoke-Json -Method $Method -Url $url -RawBody $rawBody

  # Compatível com Windows PowerShell 5.1 (sem operador ternário)
  $color = "Red"
  if ($res.Code -ge 200 -and $res.Code -lt 300) { $color = "Green" }

  Write-Host "### $Name — $($res.Code)" -ForegroundColor $color
  Write-Output $res.Body
  Write-Host ""
}

# 1) health
Test-Req -Name "GET /api/health" -Method GET -Path "/api/health"

# 2) scan
$scanBody = @{ mint = "So11111111111111111111111111111111111111112"; network = "devnet" }
Test-Req -Name "POST /api/scan" -Method POST -Path "/api/scan" -BodyObj $scanBody

# 3) simulate
$simulateBody = @{ mint = "So11111111111111111111111111111111111111112"; network = "devnet"; amount = 1.5; slippageBps = 50 }
Test-Req -Name "POST /api/simulate" -Method POST -Path "/api/simulate" -BodyObj $simulateBody

# 4) apply
$applyBody = @{ mint = "So11111111111111111111111111111111111111112"; network = "devnet"; amount = 1.5; slippageBps = 50 }
Test-Req -Name "POST /api/apply" -Method POST -Path "/api/apply" -BodyObj $applyBody
