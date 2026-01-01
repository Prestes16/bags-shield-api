param(
  [string]$BaseUrl = "https://bags-shield-api.vercel.app",
  [ValidateSet("invalidEmpty","invalidKey","passthrough")]
  [string]$Mode = "invalidEmpty",
  [string[]]$Vaults = @()
)

$ErrorActionPreference = "Stop"

$uri = "$BaseUrl/api/bags/pool-config"

# Monta body conforme o modo
$body = switch ($Mode) {
  "invalidEmpty" {
    # esperado: 400 MISSING_FEE_CLAIMER_VAULTS
    @{ feeClaimerVaults = @() }
  }
  "invalidKey" {
    # esperado: 400 INVALID_VAULT (não é base58)
    @{ feeClaimerVaults = @("NOT_A_PUBKEY!!!") }
  }
  default {
    # passthrough: valida aqui e envia pro upstream
    # Se você não passar -Vaults, usamos um pubkey sintaticamente válido
    if ($Vaults -and $Vaults.Count -gt 0) {
      @{ feeClaimerVaults = $Vaults }
    } else {
      @{ feeClaimerVaults = @("ZMZG8NYM5ELH2spunNJBfB3MJCjeJVxS6SGdVVUdrGL") }
    }
  }
}

$bodyJson = $body | ConvertTo-Json -Depth 6

$tmp = Join-Path $env:TEMP "bags-pool-config-smoke.json"
$bodyJsonLf = ($bodyJson -replace "`r`n","`n")
[System.IO.File]::WriteAllText($tmp, $bodyJsonLf + "`n", (New-Object System.Text.UTF8Encoding($false)))

Write-Host "=== Smoke: POST /api/bags/pool-config ===" -ForegroundColor Cyan
Write-Host "URL : $uri"
Write-Host "Mode: $Mode"
Write-Host "Body file: $tmp"
Write-Host $bodyJson
Write-Host ""

curl.exe -sS -i -X POST "$uri" -H "Content-Type: application/json" --data-binary "@$tmp"
