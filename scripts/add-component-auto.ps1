# Adiciona componente do v0.app respondendo 'N' para todos os prompts
$url = "https://v0.app/chat/b/b_N9AI6pyeWFP?token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..GtD5AM_Lhy2X_tYB.5HxpIT4Bzb9R_R32giWrnG5N_CWIGSd282ebsl4VFNILf5kDZf6ndafgt-8.ikAh3YY0GWCj2w356agVJA"

# Criar arquivo temporário com respostas
$responses = "N`n" * 20
$tempFile = [System.IO.Path]::GetTempFileName()
$responses | Out-File -FilePath $tempFile -Encoding ASCII -NoNewline

try {
    Get-Content $tempFile | npx shadcn@latest add $url --yes
} finally {
    Remove-Item $tempFile -ErrorAction SilentlyContinue
}
