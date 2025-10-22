# bags-shield-api — Morning Smokes (alias) — v2
$ErrorActionPreference='Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8

$base = 'https://bags-shield-api.vercel.app'
$AUTH = 'dev-123'

$utc    = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss') + 'Z'
$stamp  = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
$logDir = Join-Path $PSScriptRoot '..\logs'
$log    = Join-Path $logDir ("smoke-" + $stamp + ".txt")
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function WriteLog([string]$s) {
  $s | Out-String | Tee-Object -FilePath $log -Append | Out-Null
}

WriteLog "=== Morning Smokes @ $utc ==="
WriteLog "Base: $base"
WriteLog ""

WriteLog "--- HEAD /api/health ---"
curl.exe -sS -I "$base/api/health" | Tee-Object -FilePath $log -Append | Out-Null
WriteLog ""

WriteLog "--- GET /api/health ---"
curl.exe -sS -i "$base/api/health" | Tee-Object -FilePath $log -Append | Out-Null
WriteLog ""
curl.exe -sS    "$base/api/health" | Tee-Object -FilePath $log -Append | Out-Null
WriteLog ""

WriteLog "--- GET /api/scan?foo=bar (auth) ---"
curl.exe -sS -i "$base/api/scan?foo=bar" -H "authorization: Bearer $AUTH" | Tee-Object -FilePath $log -Append | Out-Null
WriteLog ""
curl.exe -sS    "$base/api/scan?foo=bar" -H "authorization: Bearer $AUTH" | Tee-Object -FilePath $log -Append | Out-Null
WriteLog ""

WriteLog "--- POST /api/simulate (auth) ---"
"{""ping"":true}" | curl.exe -sS -i -X POST "$base/api/simulate" -H "content-type: application/json" -H "authorization: Bearer $AUTH" --data-binary "@-" | Tee-Object -FilePath $log -Append | Out-Null
WriteLog ""
"{""ping"":true}" | curl.exe -sS    -X POST "$base/api/simulate" -H "content-type: application/json" -H "authorization: Bearer $AUTH" --data-binary "@-" | Tee-Object -FilePath $log -Append | Out-Null
WriteLog ""

$k=[guid]::NewGuid().ToString()
WriteLog ("--- POST /api/apply (auth, idem=" + $k + ") ---")
("{""mint"":""demo-mint-001"",""network"":""devnet"",""action"":""flag"",""idempotencyKey"":""$k""}") |
  curl.exe -sS -i -X POST "$base/api/apply" -H "content-type: application/json" -H "authorization: Bearer $AUTH" --data-binary "@-" |
  Tee-Object -FilePath $log -Append | Out-Null
WriteLog ""
("{""mint"":""demo-mint-001"",""network"":""devnet"",""action"":""flag"",""idempotencyKey"":""$k""}") |
  curl.exe -sS    -X POST "$base/api/apply" -H "content-type: application/json" -H "authorization: Bearer $AUTH" --data-binary "@-" |
  Tee-Object -FilePath $log -Append | Out-Null
WriteLog ""

WriteLog "=== FIM ==="
Write-Host "Log gerado em: $log"