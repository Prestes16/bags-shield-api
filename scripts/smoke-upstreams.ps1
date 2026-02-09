# Smoke tests por upstream - imprime status + x-bs-handler + x-bs-upstreams
# Uso: pnpm dev em outro terminal, depois:
#   powershell -ExecutionPolicy Bypass -File scripts/smoke-upstreams.ps1
#   $env:BASE_URL="http://127.0.0.1:3001"; .\scripts\smoke-upstreams.ps1
#   $env:BASE_URL="http://127.0.0.1:3000"; .\scripts\smoke-upstreams.ps1
# Nota: _whoami usa timeout maior (30s) - primeira compilação Next pode demorar

$base = if ($env:BASE_URL) { $env:BASE_URL.TrimEnd('/') } else { "http://127.0.0.1:3000" }
$mint = "So11111111111111111111111111111111111111112"
$exitCode = 0
$whoamiTimeout = if ($env:SMOKE_WHOAMI_TIMEOUT) { [int]$env:SMOKE_WHOAMI_TIMEOUT } else { 30 }
$defaultTimeout = if ($env:SMOKE_TIMEOUT) { [int]$env:SMOKE_TIMEOUT } else { 20 }

function Get-ResponseInfo {
  param([string]$Url, [string]$Method = "GET", [object]$Body = $null, [int]$TimeoutSec = 20)
  try {
    $params = @{
      Uri             = $Url
      Method          = $Method
      UseBasicParsing = $true
      Headers         = @{ "Accept" = "application/json" }
      TimeoutSec      = $TimeoutSec
    }
    if ($Body) {
      $params["ContentType"] = "application/json"
      $params["Body"] = ($Body | ConvertTo-Json)
    }
    $r = Invoke-WebRequest @params
    return @{
      Status      = $r.StatusCode
      Handler     = $r.Headers["x-bs-handler"]
      Upstreams   = $r.Headers["x-bs-upstreams"]
      RequestId   = $r.Headers["x-request-id"]
      BodySnippet = $r.Content.Substring(0, [Math]::Min(120, $r.Content.Length))
    }
  }
  catch {
    $resp = $_.Exception.Response
    $status = if ($resp) { [int]$resp.StatusCode } else { 0 }
    $handler = if ($resp) { $resp.Headers["x-bs-handler"] } else { $null }
    $upstreams = if ($resp) { $resp.Headers["x-bs-upstreams"] } else { $null }
    $reqId = if ($resp) { $resp.Headers["x-request-id"] } else { $null }
    $errBody = ""
    try {
      if ($resp -and $resp.GetResponseStream()) {
        $reader = [System.IO.StreamReader]::new($resp.GetResponseStream())
        $errBody = $reader.ReadToEnd()
      }
    }
    catch { }
    return @{
      Status      = $status
      Handler     = $handler
      Upstreams   = $upstreams
      RequestId   = $reqId
      BodySnippet = if ($errBody) { $errBody.Substring(0, [Math]::Min(150, $errBody.Length)) } else { $_.Exception.Message }
    }
  }
}

Write-Host "=== Smoke Upstreams ===" -ForegroundColor Magenta
Write-Host "Base: $base"
Write-Host ""

# 1) /api/_whoami (timeout maior - primeira compilação Next pode demorar)
Write-Host "[1] GET /api/_whoami (timeout ${whoamiTimeout}s)" -ForegroundColor Cyan
$r1 = Get-ResponseInfo -Url "$base/api/_whoami" -TimeoutSec $whoamiTimeout
Write-Host "  Status: $($r1.Status)" -ForegroundColor $(if ($r1.Status -eq 200) { "Green" } else { "Yellow" })
Write-Host "  x-bs-handler: $($r1.Handler)"
if ($r1.BodySnippet) { Write-Host "  Body: $($r1.BodySnippet)..." }
Write-Host ""

# 2) /api/rpc/health
Write-Host "[2] GET /api/rpc/health" -ForegroundColor Cyan
$r2 = Get-ResponseInfo -Url "$base/api/rpc/health" -TimeoutSec $defaultTimeout
Write-Host "  Status: $($r2.Status)" -ForegroundColor $(if ($r2.Status -eq 200) { "Green" } else { "Yellow" })
Write-Host "  x-bs-handler: $($r2.Handler)"
if ($r2.BodySnippet) { Write-Host "  Body: $($r2.BodySnippet)..." }
Write-Host ""

# 3) /api/market/summary
Write-Host "[3] GET /api/market/summary?mint=$mint" -ForegroundColor Cyan
$r3 = Get-ResponseInfo -Url "$base/api/market/summary?mint=$mint" -TimeoutSec $defaultTimeout
Write-Host "  Status: $($r3.Status)" -ForegroundColor $(if ($r3.Status -in @(200, 502)) { "Green" } else { "Red"; $exitCode = 1 })
Write-Host "  x-bs-handler: $($r3.Handler)"
if ($r3.BodySnippet) { Write-Host "  Body: $($r3.BodySnippet)..." }
Write-Host ""

# 4) POST /api/scan (501=key inválida; 200=ok; 401/403/502 conforme upstream)
Write-Host "[4] POST /api/scan" -ForegroundColor Cyan
$r4 = Get-ResponseInfo -Url "$base/api/scan" -Method POST -Body @{ mint = $mint } -TimeoutSec $defaultTimeout
$okScan = $r4.Status -in @(200, 501, 401, 403, 502)
Write-Host "  Status: $($r4.Status)" -ForegroundColor $(if ($okScan) { "Green" } else { "Red"; $exitCode = 1 })
Write-Host "  x-bs-handler: $($r4.Handler)"
Write-Host "  x-bs-upstreams: $($r4.Upstreams)"
Write-Host "  x-request-id: $($r4.RequestId)"
if ($r4.BodySnippet) { Write-Host "  Body: $($r4.BodySnippet)..." }
Write-Host ""

if ($exitCode -eq 0) { Write-Host "=== Smoke PASSED ===" -ForegroundColor Green } else { Write-Host "=== Smoke FAILED ===" -ForegroundColor Red }
exit $exitCode
