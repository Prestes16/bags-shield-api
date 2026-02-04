# Verifica Helius no formato do bags-shield-app:
# - HELIUS_RPC_URL com api-key na URL
# - HELIUS_ENHANCED_API_BASE (base da Enhanced API)
# Uso: Execute na raiz do projeto onde está .env.local (app ou api).
#      Para app: Set-Location C:\Dev\bags-shield-app; .\scripts\verify-helius-env-app-style.ps1
#      Para api: coloque no .env.local as vars no formato do app e execute aqui.

[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$ErrorActionPreference = "Stop"

$envFile = ".env.local"
if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Arquivo $envFile nao encontrado. Execute na raiz do projeto."
}

$raw = Get-Content -LiteralPath $envFile -Raw -Encoding UTF8

function GetEnv([string]$name) {
    $m = [regex]::Match($raw, "(?m)^\s*" + [regex]::Escape($name) + "\s*=\s*(.+?)\s*$")
    if ($m.Success) { return $m.Groups[1].Value.Trim().Trim('"').Trim("'") }
    return $null
}

$rpc = GetEnv "HELIUS_RPC_URL"
$enh = GetEnv "HELIUS_ENHANCED_API_BASE"

if ([string]::IsNullOrWhiteSpace($rpc)) { throw "HELIUS_RPC_URL ausente no .env.local" }
if ([string]::IsNullOrWhiteSpace($enh)) { throw "HELIUS_ENHANCED_API_BASE ausente no .env.local" }

# Extrai api-key (sem imprimir)
$m = [regex]::Match($rpc, 'api-key=([^&\s]+)')
if (-not $m.Success) { throw "Nao achei api-key=... dentro do HELIUS_RPC_URL" }
$key = $m.Groups[1].Value
$enc = [System.Uri]::EscapeDataString($key)

# Log sanitizado
$sanRpc = $rpc -replace 'api-key=[^&]+', 'api-key=***'
Write-Host "=== HELIUS RPC (sanitizado) ===" -ForegroundColor Cyan
Write-Host $sanRpc -ForegroundColor DarkGray

Write-Host "`n=== RPC: getHealth ===" -ForegroundColor Cyan
$body = '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
curl.exe -s -X POST "$rpc" -H "Content-Type: application/json" -d $body

Write-Host "`n=== ENHANCED: GET /v0/webhooks (sanitizado) ===" -ForegroundColor Cyan
$enhUrl = "$enh/webhooks?api-key=$enc"
$sanEnh = $enhUrl -replace 'api-key=[^&]+', 'api-key=***'
Write-Host $sanEnh -ForegroundColor DarkGray

$hdr = Join-Path $PWD ".tmp.helius.headers.txt"
$bod = Join-Path $PWD ".tmp.helius.body.txt"
curl.exe -s -D $hdr -o $bod "$enhUrl" -H "Accept: application/json"

Get-Content $hdr | Select-String -Pattern 'HTTP/|content-type:|x-ratelimit|retry-after' -CaseSensitive:$false
Write-Host "`n--- BODY (primeiros 120 chars) ---" -ForegroundColor DarkGray
$len = (Get-Item $bod).Length
if ($len -gt 0) {
    (Get-Content $bod -Raw).Substring(0, [Math]::Min(120, $len))
}
else {
    "(vazio)"
}
