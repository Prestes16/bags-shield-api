param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Origin  = "http://localhost:5173",
  [string]$Mint    = "So11111111111111111111111111111111111111112"
)

function Log($fh, $text) {
  $stamp = (Get-Date).ToString("s")
  $line  = "[$stamp] $text"
  Write-Host $line
  Add-Content -Path $fh -Value $line
}

$ts = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Path "logs" -Force | Out-Null
$fh = "logs/smoke-$ts.txt"

Log $fh "=== SMOKE START BaseUrl=$BaseUrl Origin=$Origin Mint=$Mint ==="

# 1) /api/scan (POST com JSON válido)
try {
  $u = "$BaseUrl/api/scan"
  $dummyRaw = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
  $bodyObj = @{
    rawTransaction = $dummyRaw
  }
  $jsonBody = $bodyObj | ConvertTo-Json -Depth 3

  $r = Invoke-WebRequest -Method POST -Uri $u -Headers @{ Origin = $Origin } -ContentType 'application/json' -Body $jsonBody -ErrorAction Stop
  Log $fh "SCAN POST: $($r.StatusCode) CT=$($r.Headers['Content-Type'])"
  Log $fh $r.Content
} catch {
  $resp   = $_.Exception.Response
  $status = if ($resp) { [int]$resp.StatusCode } else { 0 }
  $ct     = if ($resp) { $resp.Headers['Content-Type'] } else { '' }
  $body   = if ($resp) { (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd() } else { '' }
  Log $fh "SCAN POST: $status CT=$ct"
  Log $fh $body
}

# 2) /api/simulate OK (usa mint válido)
try {
  $u = "$BaseUrl/api/simulate"
  $bodyObj = @{
    mint = $Mint
  }
  $jsonBody = $bodyObj | ConvertTo-Json -Depth 3

  $r = Invoke-WebRequest -Method POST -Uri $u -Headers @{ Origin=$Origin; Authorization='Bearer dev' } -ContentType 'application/json' -Body $jsonBody -ErrorAction Stop
  Log $fh "SIMULATE OK: $($r.StatusCode) CT=$($r.Headers['Content-Type'])"
  Log $fh $r.Content
} catch {
  $resp   = $_.Exception.Response
  $status = if ($resp) { [int]$resp.StatusCode } else { 0 }
  $ct     = if ($resp) { $resp.Headers['Content-Type'] } else { '' }
  $body   = if ($resp) { (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd() } else { '' }
  Log $fh "SIMULATE OK: $status CT=$ct"
  Log $fh $body
}

# 3) /api/apply POST {}
try {
  $u = "$BaseUrl/api/apply"
  $r = Invoke-WebRequest -Method POST -Uri $u -Headers @{ Origin=$Origin; Authorization='Bearer dev' } -ContentType 'application/json' -Body '{}' -ErrorAction Stop
  Log $fh "APPLY POST {}: $($r.StatusCode) CT=$($r.Headers['Content-Type'])"
  Log $fh $r.Content
} catch {
  $resp   = $_.Exception.Response
  $status = if ($resp) { [int]$resp.StatusCode } else { 0 }
  $ct     = if ($resp) { $resp.Headers['Content-Type'] } else { '' }
  $body   = if ($resp) { (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd() } else { '' }
  Log $fh "APPLY POST {}: $status CT=$ct"
  Log $fh $body
}

# 4) Endpoints de token (ainda não implementados)
Log $fh "TOKEN CREATORS: SKIP (rota ainda não implementada)"
Log $fh "TOKEN FEES: SKIP (rota ainda não implementada)"

Log $fh "=== SMOKE DONE (arquivo: $fh) ==="
Write-Host "`nResumo salvo em $fh"
