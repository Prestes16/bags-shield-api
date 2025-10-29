# Bags Shield — smoke/CI v0 (HttpWebRequest + headers compat PS 5.1)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[System.Net.ServicePointManager]::Expect100Continue = $false

function Get-Header($h, [string]$name) {
  if ($null -eq $h) { return $null }
  if ($h -is [System.Collections.Specialized.NameValueCollection] -or
      $h -is [System.Net.WebHeaderCollection]) {
    foreach ($k in $h.AllKeys) { if ($k -ieq $name) { return $h.Get($k) } }
    return $null
  } elseif ($h -is [hashtable]) {
    foreach ($k in $h.Keys) { if ($k -ieq $name) { return $h[$k] } }
    return $null
  } else { try { return $h[$name] } catch { return $null } }
}
function Assert([bool]$cond, [string]$msg) {
  if (-not $cond) { Write-Host "❌ $msg"; exit 1 } else { Write-Host "✅ $msg" }
}
function Invoke-JsonReq([string]$method, [string]$url, $body = $null) {
  $hdrBase = @{ 'x-shield-api-version'='v0'; 'x-shield-schema-version'='v0' }
  $enc = [System.Text.Encoding]::UTF8
  $req = [System.Net.HttpWebRequest]::Create($url)
  $req.Method = $method
  $req.ContentType = 'application/json'
  foreach ($k in $hdrBase.Keys) { $req.Headers[$k] = [string]$hdrBase[$k] }

  if ($body -ne $null) {
    $raw = $body | ConvertTo-Json -Depth 20
    $bytes = $enc.GetBytes($raw)
    $req.ContentLength = $bytes.Length
    $s = $req.GetRequestStream(); $s.Write($bytes,0,$bytes.Length); $s.Close()
  } else { $req.ContentLength = 0 }

  try { $resp = [System.Net.HttpWebResponse]$req.GetResponse() }
  catch [System.Net.WebException] { $resp = [System.Net.HttpWebResponse]$_.Exception.Response }

  $code = 0; $hdrs = $null; $content = ''
  if ($resp -ne $null) {
    $code = [int]$resp.StatusCode
    $hdrs = $resp.Headers
    $sr = New-Object System.IO.StreamReader($resp.GetResponseStream(), $enc)
    $content = $sr.ReadToEnd(); $sr.Close()
  }
  $json = $null; try { $json = $content | ConvertFrom-Json -ErrorAction Stop } catch {}
  return @{ code=$code; headers=$hdrs; json=$json; body=$content }
}

$base   = 'http://localhost:4000'
$token  = 'So11111111111111111111111111111111111111112'
$scanObj = @{ chain='solana'; cluster='mainnet'; tokenMint=$token; options=@{deepScan=$true}; context=@{locale='pt-BR'} }
$simObj  = @{ action='BUY'; chain='solana'; cluster='mainnet'; mint=$token; input=@{sol=0.5}; slippageBps=50; context=@{locale='pt-BR'} }

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
Assert (($r.json -ne $null) -and ($r.json.success -eq $false)) "scan inválido success false"
Assert ($null -ne (Get-Header $r.headers 'X-Request-Id')) "scan 400 tem X-Request-Id"

# Scan 405 (método errado)
$r = Invoke-JsonReq GET "$base/api/v0/scan"
Assert ($r.code -eq 405) "scan GET 405"
Assert ($r.json.success -eq $false) "scan GET success false"
Assert ($null -ne (Get-Header $r.headers 'X-Request-Id')) "scan 405 tem X-Request-Id"

Write-Host "🎯 ALL GREEN — v0 está sólido"
exit 0
