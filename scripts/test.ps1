# Bags Shield — smoke/CI v0
$ErrorActionPreference = 'Stop'

function Get-Header([hashtable]$h, [string]$name) {
  foreach ($k in $h.Keys) { if ($k -ieq $name) { return $h[$k] } } return $null
}
function Assert([bool]$cond, [string]$msg) {
  if (-not $cond) { Write-Host "❌ $msg"; exit 1 } else { Write-Host "✅ $msg" }
}
function Invoke-JsonReq([string]$method, [string]$url, $body = $null) {
  $headers = @{ 'x-shield-api-version'='v0'; 'x-shield-schema-version'='v0' }
  try {
    if ($body -ne $null) { $raw = ($body | ConvertTo-Json -Depth 20) } else { $raw = $null }
    $resp = Invoke-WebRequest -Method $method -Uri $url -Headers $headers -ContentType 'application/json' -Body $raw -ErrorAction Stop
    $code = [int]$resp.StatusCode; $hdrs = $resp.Headers; $content = $resp.Content
  } catch {
    $webResp = $_.Exception.Response
    if ($webResp -ne $null) {
      $sr = New-Object System.IO.StreamReader($webResp.GetResponseStream()); $content = $sr.ReadToEnd(); $sr.Close()
      $code = [int]$webResp.StatusCode; $hdrs = $webResp.Headers
    } else { throw }
  }
  $json = $null; try { $json = $content | ConvertFrom-Json -ErrorAction Stop } catch {}
  return @{ code=$code; headers=$hdrs; json=$json; body=$content }
}

$base = 'http://localhost:4000'
$token = 'So11111111111111111111111111111111111111112'
$scanObj = @{ chain='solana'; cluster='mainnet'; tokenMint=$token; options=@{deepScan=$true}; context=@{locale='pt-BR'} }
$simObj  = @{ action='BUY';   chain='solana'; cluster='mainnet'; mint=$token; input=@{sol=0.5}; slippageBps=50; context=@{locale='pt-BR'} }

# Health 200
$r = Invoke-JsonReq GET "$base/api/health"
Assert ($r.code -eq 200) "health 200"
Assert ($r.json.ok -eq $true) "health ok==true"

# Scan 200
$r = Invoke-JsonReq POST "$base/api/v0/scan" $scanObj
Assert ($r.code -eq 200) "scan 200"
Assert ($r.json.success -eq $true) "scan success true"
Assert ($null -ne $r.json.response.shieldScore.score) "scan tem shieldScore.score"
Assert ($null -ne (Get-Header $r.headers 'X-Request-Id')) "scan header X-Request-Id"

# Simulate 200
$r = Invoke-JsonReq POST "$base/api/v0/simulate" $simObj
Assert ($r.code -eq 200) "simulate 200"
Assert ($r.json.success -eq $true) "simulate success true"
Assert ($null -ne $r.json.response.outcomeRisk.shieldScore.score) "simulate tem outcomeRisk.shieldScore.score"
Assert ($null -ne (Get-Header $r.headers 'X-Request-Id')) "simulate header X-Request-Id"

# Scan 400 (input inválido)
$badScan = @{ chain='solana'; cluster='mainnet'; options=@{deepScan=$true}; context=@{locale='pt-BR'} }
$r = Invoke-JsonReq POST "$base/api/v0/scan" $badScan
Assert ($r.code -eq 400) "scan 400 inválido"
Assert ($r.json.success -eq $false) "scan inválido success false"
Assert ($null -ne (Get-Header $r.headers 'X-Request-Id')) "scan 400 tem X-Request-Id"

# Scan 405 (método errado)
$r = Invoke-JsonReq GET "$base/api/v0/scan"
Assert ($r.code -eq 405) "scan GET 405"
Assert ($r.json.success -eq $false) "scan GET success false"
Assert ($null -ne (Get-Header $r.headers 'X-Request-Id')) "scan 405 tem X-Request-Id"

Write-Host "🎯 ALL GREEN — v0 está sólido"
exit 0
