param(
  [string]$Base = "https://bags-shield-gegyqy3be-cleiton-prestes-s-projects.vercel.app",
  [string]$Mint = "So11111111111111111111111111111111111111112"
)

function Test-URL {
  param([string]$Url,[string]$Method="GET")
  try {
    $resp = Invoke-WebRequest -Uri $Url -Method $Method -Headers @{ Accept = "application/json" } -TimeoutSec 30
    $obj = $null
    try { $obj = $resp.Content | ConvertFrom-Json } catch {}
    [pscustomobject]@{
      method  = $Method
      url     = $Url
      status  = [int]$resp.StatusCode
      success = $(if ($obj) { $obj.success } else { $null })
      error   = $(if ($obj) { $obj.error } else { $null })
      body    = $(if ($obj) { $obj.response } else { $null })
      cors    = $resp.Headers['access-control-allow-origin']
    }
  } catch {
    $status = -1
    if ($_.Exception.Response) { try { $status = [int]$_.Exception.Response.StatusCode } catch {} }
    [pscustomobject]@{
      method  = $Method
      url     = $Url
      status  = $status
      success = $false
      error   = $_.Exception.Message
      body    = $null
      cors    = $null
    }
  }
}

$urls = @(
  "$Base/api/router.ts?path=/api/health",
  "$Base/api/router.ts?path=/api/token/$Mint/creators&mint=$Mint",
  "$Base/api/router.ts?path=/api/token/$Mint/lifetime-fees&mint=$Mint",
  "$Base/api/health",
  "$Base/api/token/$Mint/creators",
  "$Base/api/token/$Mint/lifetime-fees"
)

$results = foreach ($u in $urls) { Test-URL -Url $u }

$results | Format-Table -AutoSize
"`nJSON completo:" | Write-Host
$results | ConvertTo-Json -Depth 8
