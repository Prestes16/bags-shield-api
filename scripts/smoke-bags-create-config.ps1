param(
  [string]$BaseUrl = "https://bags-shield-api.vercel.app",
  [string]$LaunchWallet = "CHANGE_ME_LAUNCH_WALLET",
  [string]$TipWallet = "CHANGE_ME_TIP_WALLET",
  [int]$TipLamports = 1000000
)

$ErrorActionPreference = "Stop"

$uri = "$BaseUrl/api/bags/create-config"

$body = @{
  launchWallet = $LaunchWallet
}

if ($TipWallet -and $TipWallet -notmatch '^CHANGE_ME_') {
  $body.tipWallet = $TipWallet
}

if ($TipLamports -gt 0) {
  $body.tipLamports = $TipLamports
}

$bodyJson = $body | ConvertTo-Json -Depth 6

$tmp = Join-Path $env:TEMP "bags-create-config-smoke.json"
$bodyJsonLf = ($bodyJson -replace "`r`n","`n")
[System.IO.File]::WriteAllText($tmp, $bodyJsonLf + "`n", (New-Object System.Text.UTF8Encoding($false)))

Write-Host "=== Smoke: POST /api/bags/create-config ===" -ForegroundColor Cyan
Write-Host "URL : $uri"
Write-Host "Body file: $tmp"
Write-Host $bodyJson
Write-Host ""

curl.exe -sS -i -X POST "$uri" -H "Content-Type: application/json" --data-binary "@$tmp"
