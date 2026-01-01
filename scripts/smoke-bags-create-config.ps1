param(
    # Base URL da API — pode trocar para http://localhost:3000 quando estiver rodando vercel dev
    [string]$BaseUrl = "https://bags-shield-api.vercel.app"
)

$ErrorActionPreference = "Stop"

# ⚠️ IMPORTANTE:
# Substitua esses valores por wallets de teste válidas (Solana pubkeys) antes de rodar "pra valer".
# Por enquanto eles servem mais para checar se o endpoint responde e como trata erro/validação.
$launchWallet = "CHANGE_ME_LAUNCH_WALLET"
$tipWallet    = "CHANGE_ME_TIP_WALLET"

$uri  = "$BaseUrl/api/bags/create-config"

$bodyObject = @{
    launchWallet = $launchWallet
    tipWallet    = $tipWallet
    tipLamports  = 1000000
}

$bodyJson = $bodyObject | ConvertTo-Json -Depth 3

Write-Host "=== Smoke: POST /api/bags/create-config ===" -ForegroundColor Cyan
Write-Host "URL : $uri"
Write-Host "Body:"
Write-Host $bodyJson
Write-Host ""

try {
    $response = Invoke-RestMethod -Method Post -Uri $uri -Body $bodyJson -ContentType "application/json" -ErrorAction Stop

    Write-Host "`n>>> SUCCESS" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 8
}
catch {
    Write-Host "`n>>> FAILED" -ForegroundColor Red

    $ex = $_.Exception
    if ($ex.Response -ne $null) {
        $statusCode = [int]$ex.Response.StatusCode
        Write-Host "HTTP status: $statusCode`n"

        try {
            $stream = $ex.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $rawBody = $reader.ReadToEnd()
            Write-Host "Raw body from server:"
            Write-Host $rawBody
        }
        catch {
            Write-Host "Could not read error body:"
            Write-Host $_
        }
    }
    else {
        Write-Host "No HTTP response object available:"
        Write-Host $ex
    }
}
