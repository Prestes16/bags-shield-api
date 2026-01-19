# Scan Completo de Erros - Bags Shield API
# Procura por problemas comuns: 500, 501, 404, imports incorretos, stacktrace leaks

$ErrorActionPreference = "Continue"
$errors = @()
$warnings = @()

Write-Host "`n=== SCAN COMPLETO DE ERROS ===" -ForegroundColor Cyan

# 1. Verificar imports .js incorretos
Write-Host "`n1. Verificando imports .js incorretos..." -ForegroundColor Yellow
$jsImports = Get-ChildItem -Path "api" -Recurse -Filter "*.ts" | Select-String -Pattern "from ['\`"]\.js['\`"]|from ['\`"]\.\.\/.*\.js['\`"]" | ForEach-Object {
    $errors += @{
        type = "import_error"
        file = $_.Path
        line = $_.LineNumber
        issue = "Import com .js pode causar erro 500"
        content = $_.Line.Trim()
    }
    Write-Host "  ❌ $($_.Path):$($_.LineNumber) - $($_.Line.Trim())" -ForegroundColor Red
}

if ($jsImports.Count -eq 0) {
    Write-Host "  ✅ Nenhum import .js incorreto encontrado" -ForegroundColor Green
}

# 2. Verificar status 500 sem tratamento adequado
Write-Host "`n2. Verificando status 500..." -ForegroundColor Yellow
$status500 = Get-ChildItem -Path "api" -Recurse -Filter "*.ts" | Select-String -Pattern "status\(500\)|\.status\(500" | ForEach-Object {
    $file = Get-Content $_.Path
    $lineNum = $_.LineNumber
    $context = $file[($lineNum - 3)..($lineNum + 3)] -join "`n"
    
    # Verificar se tem proteção contra stacktrace
    $hasProtection = $context -match "isDev|NODE_ENV|VERCEL_ENV" -or $context -match "internal server error"
    
    if (-not $hasProtection) {
        $warnings += @{
            type = "500_no_protection"
            file = $_.Path
            line = $lineNum
            issue = "Status 500 pode vazar stacktrace"
        }
        Write-Host "  ⚠️  $($_.Path):$lineNum - Pode vazar stacktrace" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ $($_.Path):$lineNum - Protegido" -ForegroundColor Green
    }
}

# 3. Verificar status 501 (deve ser usado para "not configured")
Write-Host "`n3. Verificando status 501..." -ForegroundColor Yellow
$status501 = Get-ChildItem -Path "api" -Recurse -Filter "*.ts" | Select-String -Pattern "status\(501\)|\.status\(501" | ForEach-Object {
    Write-Host "  ℹ️  $($_.Path):$($_.LineNumber) - Status 501 encontrado" -ForegroundColor Cyan
}

# 4. Verificar status 404
Write-Host "`n4. Verificando status 404..." -ForegroundColor Yellow
$status404 = Get-ChildItem -Path "api" -Recurse -Filter "*.ts" | Select-String -Pattern "status\(404\)|\.status\(404|Not Found" -CaseSensitive:$false | ForEach-Object {
    Write-Host "  ℹ️  $($_.Path):$($_.LineNumber) - Status 404 encontrado" -ForegroundColor Cyan
}

# 5. Verificar console.error com stacktrace
Write-Host "`n5. Verificando console.error com stacktrace..." -ForegroundColor Yellow
$consoleErrors = Get-ChildItem -Path "api" -Recurse -Filter "*.ts" | Select-String -Pattern "console\.error.*stack|console\.error.*\.stack" -CaseSensitive:$false | ForEach-Object {
    $warnings += @{
        type = "console_stack"
        file = $_.Path
        line = $_.LineNumber
        issue = "console.error pode logar stacktrace"
    }
    Write-Host "  ⚠️  $($_.Path):$($_.LineNumber) - Pode logar stacktrace" -ForegroundColor Yellow
}

# 6. Verificar try/catch sem tratamento adequado
Write-Host "`n6. Verificando try/catch sem tratamento..." -ForegroundColor Yellow
$tryCatch = Get-ChildItem -Path "api" -Recurse -Filter "*.ts" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $lines = Get-Content $_.FullName
    $hasTry = $content -match "try\s*\{"
    
    if ($hasTry) {
        $tryBlocks = [regex]::Matches($content, "try\s*\{[^}]*catch")
        foreach ($match in $tryBlocks) {
            $catchBlock = $match.Value
            if ($catchBlock -notmatch "console\.error" -and $catchBlock -notmatch "res\.status\(500\)" -and $catchBlock -notmatch "res\.status\([45]")) {
                $lineNum = ($content.Substring(0, $match.Index) -split "`n").Count
                $warnings += @{
                    type = "try_catch_empty"
                    file = $_.FullName
                    line = $lineNum
                    issue = "Try/catch pode não estar tratando erro adequadamente"
                }
                Write-Host "  ⚠️  $($_.Name):$lineNum - Try/catch pode estar incompleto" -ForegroundColor Yellow
            }
        }
    }
}

# 7. Verificar imports de lib/cors sem req
Write-Host "`n7. Verificando uso de setCors sem req..." -ForegroundColor Yellow
$setCorsCalls = Get-ChildItem -Path "api" -Recurse -Filter "*.ts" | Select-String -Pattern "setCors\(res\)" | ForEach-Object {
    $warnings += @{
        type = "setCors_no_req"
        file = $_.Path
        line = $_.LineNumber
        issue = "setCors deve receber req para CORS dinâmico"
    }
    Write-Host "  ⚠️  $($_.Path):$($_.LineNumber) - setCors sem req" -ForegroundColor Yellow
}

# 8. Verificar ensureRequestId antes de usar
Write-Host "`n8. Verificando ensureRequestId..." -ForegroundColor Yellow
$requestIdIssues = Get-ChildItem -Path "api" -Recurse -Filter "*.ts" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match "requestId" -and $content -notmatch "ensureRequestId") {
        $warnings += @{
            type = "requestId_missing"
            file = $_.FullName
            issue = "Usa requestId mas não chama ensureRequestId"
        }
        Write-Host "  ⚠️  $($_.Name) - Pode estar usando requestId sem ensureRequestId" -ForegroundColor Yellow
    }
}

# Resumo
Write-Host "`n=== RESUMO ===" -ForegroundColor Cyan
Write-Host "Erros encontrados: $($errors.Count)" -ForegroundColor $(if ($errors.Count -eq 0) { "Green" } else { "Red" })
Write-Host "Avisos encontrados: $($warnings.Count)" -ForegroundColor $(if ($warnings.Count -eq 0) { "Green" } else { "Yellow" })

if ($errors.Count -gt 0) {
    Write-Host "`n=== ERROS CRÍTICOS ===" -ForegroundColor Red
    $errors | ForEach-Object {
        Write-Host "  [$($_.type)] $($_.file):$($_.line)" -ForegroundColor Red
        Write-Host "    $($_.issue)" -ForegroundColor Gray
    }
}

if ($warnings.Count -gt 0) {
    Write-Host "`n=== AVISOS ===" -ForegroundColor Yellow
    $warnings | ForEach-Object {
        Write-Host "  [$($_.type)] $($_.file)$(if ($_.line) { ":$($_.line)" })" -ForegroundColor Yellow
        Write-Host "    $($_.issue)" -ForegroundColor Gray
    }
}

# Salvar relatório
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportFile = "logs/error-scan-$timestamp.json"
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}

$report = @{
    timestamp = $timestamp
    errors = $errors
    warnings = $warnings
    summary = @{
        totalErrors = $errors.Count
        totalWarnings = $warnings.Count
    }
}

$report | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportFile -Encoding UTF8
Write-Host "`nRelatório salvo em: $reportFile" -ForegroundColor Gray

if ($errors.Count -gt 0) {
    exit 1
} else {
    exit 0
}
