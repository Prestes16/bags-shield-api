# Smoke checks locais para Bags Shield App (Next.js)
# Uso: pnpm dev em outro terminal, depois: powershell -ExecutionPolicy Bypass -File scripts/smoke-local.ps1
# Ou: $env:BASE_URL="http://localhost:3000"; .\scripts\smoke-local.ps1

$base = if ($env:BASE_URL) { $env:BASE_URL.TrimEnd('/') } else { "http://localhost:3000" }
$mint = "So11111111111111111111111111111111111111112"  # wrapped SOL
$exitCode = 0

function Test-Endpoint {
  param([string]$Name, [string]$Method, [string]$Url, [object]$Body = $null, [int[]]$AcceptStatuses = @(200))
  Write-Host ""
  Write-Host "[smoke] $Name" -ForegroundColor Cyan
  Write-Host "  $Method $Url"
  try {
    $params = @{
      Uri             = $Url
      Method          = $Method
      UseBasicParsing = $true
      Headers         = @{ "Accept" = "application/json" }
      TimeoutSec      = 15
    }
    if ($Body) {
      $params["ContentType"] = "application/json"
      $params["Body"] = ($Body | ConvertTo-Json)
    }
    $r = Invoke-WebRequest @params
    $ok = $AcceptStatuses -contains $r.StatusCode
    if ($ok) { Write-Host "  Status: $($r.StatusCode) OK" -ForegroundColor Green } else { Write-Host "  Status: $($r.StatusCode) (esperado: $($AcceptStatuses -join ','))" -ForegroundColor Red }
    Write-Host "  Response: $($r.Content.Substring(0, [Math]::Min(120, $r.Content.Length)))..."
    return $ok
  }
  catch {
    $status = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { 0 }
    $errBody = ""
    try { $stream = $_.Exception.Response.GetResponseStream(); if ($stream) { $reader = [System.IO.StreamReader]::new($stream); $errBody = $reader.ReadToEnd() } } catch {}
    $ok = $AcceptStatuses -contains $status
    if ($ok) { Write-Host "  Status: $status (aceitavel)" -ForegroundColor Yellow } else { Write-Host "  Status: $status (erro)" -ForegroundColor Red }
    if ($errBody) { Write-Host "  Body: $($errBody.Substring(0, [Math]::Min(200, $errBody.Length)))" }
    return $ok
  }
}

Write-Host "=== Smoke Local ===" -ForegroundColor Magenta
Write-Host "Base: $base"
Write-Host "Mint: $mint"

# 1) GET /api/market/summary?mint=So111... (200 ok/stub ou 502 proxy unavailable)
if (-not (Test-Endpoint -Name "1. GET /api/market/summary" -Method GET -Url "$base/api/market/summary?mint=$mint" -AcceptStatuses @(200, 502))) { $exitCode = 1 }

# 2) GET /api/status
if (-not (Test-Endpoint -Name "2. GET /api/status" -Method GET -Url "$base/api/status")) { $exitCode = 1 }

# 3) GET /api/rpc/health
if (-not (Test-Endpoint -Name "3. GET /api/rpc/health" -Method GET -Url "$base/api/rpc/health")) { $exitCode = 1 }

# 4) POST /api/scan (interpretar status conforme env)
Write-Host ""
Write-Host "[smoke] 4. POST /api/scan" -ForegroundColor Cyan
Write-Host "  POST $base/api/scan"
try {
  $body = @{ mint = $mint }
  $r = Invoke-WebRequest -Uri "$base/api/scan" -Method POST -ContentType "application/json" -Body ($body | ConvertTo-Json) -UseBasicParsing -TimeoutSec 15 -Headers @{ "Accept" = "application/json" }
  $json = $r.Content | ConvertFrom-Json
  # 501 = Helius não configurado; 401 = chave inválida; 403 = restrito; 502 = upstream; 200 = ok
  $okStatuses = @(200, 501, 401, 403, 502)
  if ($okStatuses -contains $r.StatusCode) {
    Write-Host "  Status: $($r.StatusCode) (esperado para env)" -ForegroundColor Green
    Write-Host "  Response: $($r.Content.Substring(0, [Math]::Min(150, $r.Content.Length)))..."
  }
  else {
    Write-Host "  Status: $($r.StatusCode) (inesperado)" -ForegroundColor Red
    $exitCode = 1
  }
}
catch {
  $status = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { "N/A" }
  $errBody = ""
  try { $stream = $_.Exception.Response.GetResponseStream(); if ($stream) { $reader = [System.IO.StreamReader]::new($stream); $errBody = $reader.ReadToEnd() } } catch {}
  # 501/401/403/502 são aceitáveis (env não configurado ou upstream)
  if ($status -in @(501, 401, 403, 502)) {
    Write-Host "  Status: $status (esperado para env)" -ForegroundColor Yellow
  }
  else {
    Write-Host "  Status: $status - $($_.Exception.Message)" -ForegroundColor Red
    $exitCode = 1
  }
  if ($errBody) { Write-Host "  Body: $($errBody.Substring(0, [Math]::Min(150, $errBody.Length)))" }
}

Write-Host ""
if ($exitCode -eq 0) { Write-Host "=== Smoke PASSED ===" -ForegroundColor Green } else { Write-Host "=== Smoke FAILED ===" -ForegroundColor Red }
exit $exitCode
