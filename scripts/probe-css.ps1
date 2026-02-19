# Probe CSS and assets from deployed Bags Shield app
# Usage: .\scripts\probe-css.ps1 [-BaseUrl "https://app.bagsshield.org"]

param(
  [string]$BaseUrl = "https://app.bagsshield.org"
)

$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$tmp = Join-Path $env:TEMP "bs_css_probe_$ts.css"

Write-Host "`n=== 1) Fetching HTML from $BaseUrl/settings?debug=1 ===" -ForegroundColor Cyan
try {
  $response = Invoke-WebRequest -Uri "${BaseUrl}/settings?debug=1&ts=$ts" -UseBasicParsing
  $html = $response.Content
  Write-Host "Status: $($response.StatusCode)  ContentLength: $($html.Length)"
} catch {
  Write-Host "ERROR: $_" -ForegroundColor Red
  exit 1
}

$css = [regex]::Matches($html, '/_next/static/css/[^"'']+\.css') | ForEach-Object { $_.Value } | Select-Object -Unique
Write-Host "`nCSS_COUNT=$($css.Count)"
$css | ForEach-Object { Write-Host "CSS: $_" }

Write-Host "`n=== 2) Probing each CSS file ===" -ForegroundColor Cyan
foreach ($c in $css) {
  $url = "${BaseUrl}${c}?ts=$ts"
  Write-Host "`n---- $c ----"
  try {
    Invoke-WebRequest -Uri $url -UseBasicParsing -OutFile $tmp | Out-Null
    $len = (Get-Item $tmp).Length
    $content = Get-Content $tmp -Raw -ErrorAction SilentlyContinue
    $hasTw = ($content -and $content -match '--tw-')
    Write-Host "len_bytes=$len  has_tailwind_tokens(--tw-)=$hasTw"
    Remove-Item $tmp -ErrorAction SilentlyContinue
  } catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
  }
}

Write-Host "`n=== 3) SW / manifest probes ===" -ForegroundColor Cyan
foreach ($path in "/service-worker.js", "/sw.js", "/asset-manifest.json", "/manifest.json") {
  Write-Host "`n== $path =="
  try {
    $r = Invoke-WebRequest -Uri "${BaseUrl}${path}?ts=$ts" -UseBasicParsing -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode)  ContentType: $($r.Headers['Content-Type'])"
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 404) {
      Write-Host "404 (expected if not present)"
    } else {
      Write-Host "ERROR: $_" -ForegroundColor Red
    }
  }
}

Write-Host "`nDone." -ForegroundColor Green
