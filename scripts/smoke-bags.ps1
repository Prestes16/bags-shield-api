param(
  [string]$HostBase = $env:BS_HOST ? $env:BS_HOST : "https://bags-shield-api.vercel.app"
)

$ErrorActionPreference = "Stop"
Write-Host "`n==> Smoke Bags (canário) — $HostBase" -ForegroundColor Cyan

function Build-Url([string]$p){
  if ($p -match '^https?://') { return $p }
  $sep = ($HostBase.TrimEnd('/')) + '/'
  return $sep + $p.TrimStart('/')
}

function Invoke-HTTP {
  param(
    [ValidateSet('GET','POST','HEAD','OPTIONS')] [string]$Method,
    [string]$Path,
    [hashtable]$Body = $null,
    [int]$TimeoutSec = 10
  )
  $url = Build-Url $Path
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    if ($Method -in @('GET','HEAD','OPTIONS')) {
      $res = Invoke-WebRequest -UseBasicParsing -Method $Method -Uri $url -TimeoutSec $TimeoutSec -ErrorAction Stop
      $json = $null
      try { $json = $res.Content | ConvertFrom-Json -ErrorAction Stop } catch {}
      return [pscustomobject]@{
        Method=$Method; Url=$url; StatusCode=$res.StatusCode; Ms=$sw.ElapsedMilliseconds; Json=$json; Raw=$res.Content
      }
    } else {
      $payload = $Body ? ($Body | ConvertTo-Json -Depth 8 -Compress) : "{}"
      $res = Invoke-WebRequest -UseBasicParsing -Method POST -Uri $url -TimeoutSec $TimeoutSec `
              -ContentType "application/json" -Body $payload -ErrorAction Stop
      $json = $null
      try { $json = $res.Content | ConvertFrom-Json -ErrorAction Stop } catch {}
      return [pscustomobject]@{
        Method=$Method; Url=$url; StatusCode=$res.StatusCode; Ms=$sw.ElapsedMilliseconds; Json=$json; Raw=$res.Content
      }
    }
  } catch {
    $resp = $_.Exception.Response
    $code = if ($resp) { [int]$resp.StatusCode } else { 0 }
    $stream = if ($resp) { $resp.GetResponseStream() } else { $null }
    $raw = $null
    if ($stream) {
      $sr = New-Object System.IO.StreamReader($stream)
      $raw = $sr.ReadToEnd()
      try { $sr.Dispose() } catch {}
    }
    $json = $null
    try { if ($raw) { $json = $raw | ConvertFrom-Json -ErrorAction Stop } } catch {}
    return [pscustomobject]@{
      Method=$Method; Url=$url; StatusCode=$code; Ms=$sw.ElapsedMilliseconds; Json=$json; Raw=$raw
    }
  } finally {
    $sw.Stop()
  }
}

function Show([string]$name, $r) {
  $rid = $r.Json.meta.requestId  # pode estar vazio em alguns casos
  $msg = "{0,-24} {1,4}  {2,5}ms  {3}" -f $name, $r.StatusCode, $r.Ms, ($rid ? $rid : "—")
  if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) { Write-Host $msg -ForegroundColor Green }
  elseif ($r.StatusCode -ge 400 -and $r.StatusCode -lt 500) { Write-Host $msg -ForegroundColor Yellow }
  else { Write-Host $msg -ForegroundColor Red }
}

# 1) Ping Bags (GET)
$r1 = Invoke-HTTP -Method GET -Path "/api/bags/ping"
Show "GET /api/bags/ping" $r1

# 2) Token Info (POST) — caso mínimo (deve dar 501 se base ausente, 200/401 se configurado)
$tokenInfo = @{
  name = "CanaryCoin"
  symbol = "CNC"
  imageUrl = "https://example.com/canary.png"
  description = "smoke canário"
}
$r2 = Invoke-HTTP -Method POST -Path "/api/bags/token-info" -Body $tokenInfo
Show "POST /api/bags/token-info" $r2

# 3) Create Config (POST) — primeiro inválido (400), depois válido (501 se base ausente)
$cfgBad = @{ launchWallet = "not-base58" }
$r3 = Invoke-HTTP -Method POST -Path "/api/bags/create-config" -Body $cfgBad
Show "POST /api/bags/create-config (400)" $r3

$cfgOk = @{ launchWallet = "9xQeWvG816bUx9EP5NQHDx4LqAP7hGz3V7iB" } # 43 chars, base58-like
$r4 = Invoke-HTTP -Method POST -Path "/api/bags/create-config" -Body $cfgOk
Show "POST /api/bags/create-config (OK)" $r4

Write-Host "`nResumo:" -ForegroundColor Cyan
"{0,-26} {1}" -f "ping", $r1.StatusCode
"{0,-26} {1}" -f "token-info", $r2.StatusCode
"{0,-26} {1}" -f "create-config(bad)", $r3.StatusCode
"{0,-26} {1}" -f "create-config(ok)", $r4.StatusCode