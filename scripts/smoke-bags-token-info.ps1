param(
  [string]$BaseUrl = "https://bags-shield-api.vercel.app",
  [ValidateSet("invalid","imageUrl","metadataUrl")]
  [string]$Mode = "invalid"
)

$ErrorActionPreference = "Stop"

$uri = "$BaseUrl/api/bags/token-info"

$body = switch ($Mode) {
  "imageUrl" {
    @{
      name        = "Bags Shield Demo"
      symbol      = "BAGSD"
      description = "Smoke test for /api/bags/token-info"
      imageUrl    = "https://placehold.co/512x512.png"
      twitter     = "https://x.com/"
      website     = "https://example.com"
    }
  }
  "metadataUrl" {
    @{
      name        = "Bags Shield Demo"
      symbol      = "BAGSD"
      description = "Smoke test for /api/bags/token-info"
      metadataUrl = "https://example.com/metadata.json"
    }
  }
  default {
    @{
      name        = "Bags Shield Demo"
      symbol      = "BAGSD"
      description = "Smoke test for /api/bags/token-info (expected 400: MISSING_MEDIA)"
    }
  }
}

$bodyJson = $body | ConvertTo-Json -Depth 6

$tmp = Join-Path $env:TEMP "bags-token-info-smoke.json"
$bodyJsonLf = ($bodyJson -replace "`r`n","`n")
[System.IO.File]::WriteAllText($tmp, $bodyJsonLf + "`n", (New-Object System.Text.UTF8Encoding($false)))

Write-Host "=== Smoke: POST /api/bags/token-info ===" -ForegroundColor Cyan
Write-Host "URL : $uri"
Write-Host "Mode: $Mode"
Write-Host "Body file: $tmp"
Write-Host $bodyJson
Write-Host ""

curl.exe -sS -i -X POST "$uri" -H "Content-Type: application/json" --data-binary "@$tmp"
