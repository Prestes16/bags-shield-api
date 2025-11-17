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

function Get-Body($resp) {
  if ($resp -is [System.Management.Automation.ErrorRecord]) {
    $r = $_.Exception.Response
    if ($r) {
      $reader = New-Object IO.StreamReader($r.GetResponseStream())
      $text = $reader.ReadToEnd(); $reader.Close()
      return $text
    }
    return ""
  }
  return $resp.Content
}

$ts = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Path "logs" -Force | Out-Null
$fh = "logs/smoke-$ts.txt"

Log $fh "=== SMOKE START BaseUrl=$BaseUrl Origin=$Origin Mint=$Mint ==="

# 1) /api/scan (POST com JSON)
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
  $resp = $_.Exception.Response
  $status  = if ($resp) { [int]$resp.StatusCode } else { 0 }
  $ct      = if ($resp) { $resp.Headers['Content-Type'] } else { '' }
  $body    = if ($resp) { (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd() } else { '' }
  Log $fh "SCAN POST: $status CT=$ct"
  Log $fh $body
}

# 2) /api/simulate BAD_JSON
try {
  $u = "$BaseUrl/api/simulate"
  Invoke-WebRequest -Method POST -Uri $u -Headers @{ Origin=$Origin; Authorization='Bearer dev' } -ContentType 'application/json' -Body '{ invalid' -ErrorAction Stop | Out-Null
} catch {
  $resp = $_.Exception.Response
  $status  = if ($resp) { [int]$resp.StatusCode } else { 0 }
  $ct      = if ($resp) { $resp.Headers['Content-Type'] } else { '' }
  $body    = if ($resp) { (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd() } else { '' }
  Log $fh "SIMULATE BAD_JSON: $status CT=$ct"
  Log $fh $body
}

# 3) /api/simulate OK
try {
  $u = "$BaseUrl/api/simulate"
  $r = Invoke-WebRequest -Method POST -Uri $u -Headers @{ Origin=$Origin; Authorization='Bearer dev' } -ContentType 'application/json' -Body '{ "ping":"pong" }' -ErrorAction Stop
  Log $fh "SIMULATE OK: $($r.StatusCode) CT=$($r.Headers['Content-Type'])"
  Log $fh $r.Content
} catch {
  Log $fh "SIMULATE OK: ERROR"
}

# 4) /api/apply OPTIONS
try {
  $u = "$BaseUrl/api/apply"
  $r = Invoke-WebRequest -Method OPTIONS -Uri $u -Headers @{ Origin=$Origin; 'Access-Control-Request-Method'='POST'; 'Access-Control-Request-Headers'='Content-Type, Authorization' } -ErrorAction Stop
  Log $fh "APPLY OPTIONS: $($r.StatusCode) ACAO=$($r.Headers['Access-Control-Allow-Origin'])"
} catch {
  Log $fh "APPLY OPTIONS: ERROR"
}

# 5) /api/apply POST {}
try {
  $u = "$BaseUrl/api/apply"
  $r = Invoke-WebRequest -Method POST -Uri $u -Headers @{ Origin=$Origin; Authorization='Bearer dev' } -ContentType 'application/json' -Body '{}' -ErrorAction Stop
  Log $fh "APPLY POST {}: $($r.StatusCode) CT=$($r.Headers['Content-Type'])"
  Log $fh $r.Content
} catch {
  $resp = $_.Exception.Response
  $status  = if ($resp) { [int]$resp.StatusCode } else { 0 }
  $ct      = if ($resp) { $resp.Headers['Content-Type'] } else { '' }
  $body    = if ($resp) { (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd() } else { '' }
  Log $fh "APPLY POST {}: $status CT=$ct"
  Log $fh $body
}

# 6) /api/token/[mint]/creators
try {
  $u = "$BaseUrl/api/token/$Mint/creators"
  $r = Invoke-WebRequest -Method GET -Uri $u -Headers @{ Origin=$Origin } -ErrorAction Stop
  Log $fh "TOKEN CREATORS: $($r.StatusCode) CT=$($r.Headers['Content-Type'])"
  Log $fh $r.Content
} catch {
  Log $fh "TOKEN CREATORS: ERROR"
}

# 7) /api/token/[mint]/lifetime-fees
try {
  $u = "$BaseUrl/api/token/$Mint/lifetime-fees"
  $r = Invoke-WebRequest -Method GET -Uri $u -Headers @{ Origin=$Origin } -ErrorAction Stop
  Log $fh "TOKEN FEES: $($r.StatusCode) CT=$($r.Headers['Content-Type'])"
  Log $fh $r.Content
} catch {
  Log $fh "TOKEN FEES: ERROR"
}

Log $fh "=== SMOKE DONE (arquivo: $fh) ==="
Write-Host "`nResumo salvo em $fh"