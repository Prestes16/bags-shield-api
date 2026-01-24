# Script para adicionar componente do v0.app sem sobrescrever package.json
param(
    [Parameter(Mandatory=$true)]
    [string]$Url
)

Write-Host "Adicionando componente do v0.app..." -ForegroundColor Cyan
Write-Host "URL: $Url" -ForegroundColor Gray

# Executar comando e responder 'N' quando perguntar sobre package.json
$input = "N`n"
$input | npx shadcn@latest add $Url --yes

Write-Host "`nComponente adicionado!" -ForegroundColor Green
