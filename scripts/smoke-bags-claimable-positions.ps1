param(
  [string]$BaseUrl = "https://bags-shield-api.vercel.app",
  [ValidateSet("invalidMissing","invalidWallet","valid")]
  [string]$Mode = "invalidMissing",
  [string]$Wallet = "ZMZG8NYM5ELH2spunNJBfB3MJCjeJVxS6SGdVVUdrGL"
)

$ErrorActionPreference = "Stop"

# Monta URL conforme o modo
$uri = switch ($Mode) {
  "invalidMissing" { "$BaseUrl/api/bags/claimable-positions" } # esperado: 400 INVALID_WALLET
  "invalidWallet"  { "$BaseUrl/api/bags/claimable-positions?wallet=NOT_A_PUBKEY!!!" } # esperado: 400 INVALID_WALLET
  default {
    # valid: usa o wallet fornecido
    $w = [Uri]::EscapeDataString($Wallet)
    "$BaseUrl/api/bags/claimable-positions?wallet=$w"
  }
}

Write-Host "=== Smoke: GET /api/bags/claimable-positions ===" -ForegroundColor Cyan
Write-Host "Mode : $Mode"
Write-Host "URL  : $uri"
Write-Host ""

curl.exe -sS -i -X GET "$uri"
