param(
  [string]$BaseUrl = "https://bags-shield-api.vercel.app",
  [ValidateSet("invalidMissing","invalidFlagType","invalidVirtualPoolMissing","passthroughVirtualPool")]
  [string]$Mode = "invalidMissing",
  [string]$FeeClaimer = "ZMZG8NYM5ELH2spunNJBfB3MJCjeJVxS6SGdVVUdrGL",
  [string]$TokenMint  = "7AMu72yaFidjwLeJJKSiLf7CPBDqoSYcyHk8H6irBAGS",
  [string]$VirtualPoolAddress = "11111111111111111111111111111111"
)

$ErrorActionPreference = "Stop"

$uri = "$BaseUrl/api/bags/claim-txs"

$body = switch ($Mode) {
  "invalidMissing" {
    # expected: 400 INVALID_FEE_CLAIMER
    @{}
  }
  "invalidFlagType" {
    # expected: 400 INVALID_FLAG_TYPE
    @{
      feeClaimer = $FeeClaimer
      tokenMint  = $TokenMint
      claimVirtualPoolFees = 1
      virtualPoolAddress = $VirtualPoolAddress
    }
  }
  "invalidVirtualPoolMissing" {
    # expected: 400 MISSING_VIRTUAL_POOL_ADDRESS
    @{
      feeClaimer = $FeeClaimer
      tokenMint  = $TokenMint
      claimVirtualPoolFees = $true
    }
  }
  default {
    # passthrough (expected right now: likely 502 because upstream returns 500 for placeholder / no position)
    @{
      feeClaimer = $FeeClaimer
      tokenMint  = $TokenMint
      claimVirtualPoolFees = $true
      virtualPoolAddress   = $VirtualPoolAddress
    }
  }
}

$bodyJson = $body | ConvertTo-Json -Compress

$tmp = Join-Path $env:TEMP "bags-claim-txs-smoke.json"
$bodyJsonLf = ($bodyJson -replace "`r`n","`n")
[System.IO.File]::WriteAllText($tmp, $bodyJsonLf + "`n", (New-Object System.Text.UTF8Encoding($false)))

Write-Host "=== Smoke: POST /api/bags/claim-txs ===" -ForegroundColor Cyan
Write-Host "URL : $uri"
Write-Host "Mode: $Mode"
Write-Host "Body file: $tmp"
Write-Host $bodyJson
Write-Host ""

curl.exe -sS -i -X POST "$uri" -H "Content-Type: application/json" --data-binary "@$tmp"
