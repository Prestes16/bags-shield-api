# Script para adicionar componente v0.app de forma não-interativa
param(
    [Parameter(Mandatory=$true)]
    [string]$Url
)

Write-Host "Adicionando componente do v0.app..." -ForegroundColor Cyan
Write-Host "URL: $Url" -ForegroundColor Gray

# Criar processo com stdin redirecionado
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "npx"
$psi.Arguments = "shadcn@latest add `"$Url`" --yes"
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $psi

# Handler para output
$outputBuilder = New-Object System.Text.StringBuilder
$errorBuilder = New-Object System.Text.StringBuilder

$outputEvent = {
    if (-not [string]::IsNullOrEmpty($EventArgs.Data)) {
        $outputBuilder.AppendLine($EventArgs.Data) | Out-Null
        Write-Host $EventArgs.Data
    }
}

$errorEvent = {
    if (-not [string]::IsNullOrEmpty($EventArgs.Data)) {
        $errorBuilder.AppendLine($EventArgs.Data) | Out-Null
        Write-Host $EventArgs.Data -ForegroundColor Red
    }
}

$process.add_OutputDataReceived($outputEvent)
$process.add_ErrorDataReceived($errorEvent)

$process.Start() | Out-Null
$process.BeginOutputReadLine()
$process.BeginErrorReadLine()

# Responder "N" para prompts sobre arquivos existentes
Start-Sleep -Milliseconds 500
$process.StandardInput.WriteLine("N")
Start-Sleep -Milliseconds 500
$process.StandardInput.WriteLine("N")
Start-Sleep -Milliseconds 500
$process.StandardInput.WriteLine("N")
$process.StandardInput.Close()

$process.WaitForExit()

Write-Host "`nProcesso finalizado com código: $($process.ExitCode)" -ForegroundColor $(if ($process.ExitCode -eq 0) { "Green" } else { "Red" })

if ($process.ExitCode -eq 0) {
    Write-Host "`nComponente adicionado com sucesso!" -ForegroundColor Green
} else {
    Write-Host "`nErro ao adicionar componente" -ForegroundColor Red
    Write-Host $errorBuilder.ToString() -ForegroundColor Red
}
