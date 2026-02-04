# Verifica HELIUS_RPC_URL e API Enhanced (Helius) no bags-shield-api
# Uso: .\scripts\verify-helius-env.ps1
# Requer: .env.local com HELIUS_API_KEY, HELIUS_RPC_URL e HELIUS_API_BASE (ou HELIUS_ENHANCED_API_BASE)

[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$ErrorActionPreference = "Stop"

$envFile = ".env.local"
if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Arquivo $envFile nao encontrado. Execute na raiz do projeto (bags-shield-api)."
}

$raw = Get-Content -LiteralPath $envFile -Raw -Encoding UTF8

function GetEnv([string]$name) {
    $m = [regex]::Match($raw, "(?m)^\s*" + [regex]::Escape($name) + "\s*=\s*(.+?)\s*$")
    if ($m.Success) { return $m.Groups[1].Value.Trim().Trim('"').Trim("'") }
    return $null
}

# bags-shield-api: key separada; RPC e Enhanced base separados
$key = GetEnv "HELIUS_API_KEY"
$rpcBase = GetEnv "HELIUS_RPC_URL"
$enhBase = GetEnv "HELIUS_API_BASE"
if ([string]::IsNullOrWhiteSpace($enhBase)) { $enhBase = GetEnv "HELIUS_ENHANCED_API_BASE" }

if ([string]::IsNullOrWhiteSpace($key)) { throw "HELIUS_API_KEY ausente no .env.local" }
if ([string]::IsNullOrWhiteSpace($rpcBase)) { throw "HELIUS_RPC_URL ausente no .env.local" }
if ([string]::IsNullOrWhiteSpace($enhBase)) { throw "HELIUS_API_BASE (ou HELIUS_ENHANCED_API_BASE) ausente no .env.local" }

# Remove trailing slash e ?api-key= da base para montar URL limpa
$rpcBase = $rpcBase -replace '/\?.*$', '' -replace '/$', ''
$enhBase = $enhBase -replace '/\?.*$', '' -replace '/$', ''

$encKey = [System.Uri]::EscapeDataString($key)
$rpcUrl = "$rpcBase/?api-key=$encKey"
$sanRpc = "$rpcBase/?api-key=***"
$sanEnh = "$enhBase/v0/...?api-key=***"

Write-Host "=== HELIUS (bags-shield-api) ===" -ForegroundColor Cyan
Write-Host "RPC (sanitizado): $sanRpc" -ForegroundColor DarkGray
Write-Host "Enhanced base (sanitizado): $enhBase (api-key=***)" -ForegroundColor DarkGray

Write-Host "`n=== RPC: getHealth ===" -ForegroundColor Cyan
$body = '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
try {
    $r = Invoke-RestMethod -Uri $rpcUrl -Method POST -ContentType "application/json" -Body $body
    if ($r.result -eq "ok") { Write-Host "OK: getHealth = $($r.result)" -ForegroundColor Green } else { Write-Host $r }
}
catch {
    Write-Host "ERRO: $_" -ForegroundColor Red
}

Write-Host "`n=== ENHANCED: GET /v0/addresses/.../transactions (sanitizado) ===" -ForegroundColor Cyan
$addr = "11111111111111111111111111111111"
$enhUrl = "$enhBase/v0/addresses/$addr/transactions?api-key=$encKey&limit=1"
Write-Host "$enhBase/v0/addresses/$addr/transactions?api-key=***&limit=1" -ForegroundColor DarkGray

$hdr = Join-Path $PWD ".tmp.helius.headers.txt"
$bod = Join-Path $PWD ".tmp.helius.body.txt"
try {
    curl.exe -s -D $hdr -o $bod "$enhUrl" -H "Accept: application/json"
    Get-Content $hdr | Select-String -Pattern 'HTTP/|content-type:|x-ratelimit|retry-after' -CaseSensitive:$false
    $len = (Get-Item $bod).Length
    Write-Host "`n--- BODY (primeiros 200 chars) ---" -ForegroundColor DarkGray
    if ($len -gt 0) {
        (Get-Content $bod -Raw).Substring(0, [Math]::Min(200, $len))
    }
    else {
        Write-Host "(vazio)"
    }
}
catch {
    Write-Host "ERRO: $_" -ForegroundColor Red
}
finally {
    if (Test-Path $hdr) { Remove-Item $hdr -Force -ErrorAction SilentlyContinue }
    if (Test-Path $bod) { Remove-Item $bod -Force -ErrorAction SilentlyContinue }
}

Write-Host "`n=== Concluido ===" -ForegroundColor Cyan
