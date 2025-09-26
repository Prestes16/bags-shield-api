Param(
  [string]$Base = "https://bags-shield-api.vercel.app",
  [string]$Mint = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWJw6z9vG9W7fZ5F"
)

Write-Host "Health:" -ForegroundColor Cyan
irm "$Base/api/health" | ConvertTo-Json -Depth 6

Write-Host "`nScan (mint):" -ForegroundColor Cyan
$r = irm "$Base/api/scan" -Method Post -ContentType "application/json" -Body (@{ mint = $Mint } | ConvertTo-Json -Compress)
$r | ConvertTo-Json -Depth 8
$r.bags.tried[0] | ConvertTo-Json -Depth 6

Write-Host "`nSimulate (SAFE):" -ForegroundColor Cyan
$bodySafe = @{
  mint = $Mint
  mock = @{
    mintAuthorityActive = $false
    top10HoldersPct    = 35
    freezeNotRenounced = $false
    tokenAgeDays       = 30
    liquidityLocked    = $true
    creatorReputation  = 80
    socialsOk          = $true
    bagsVerified       = $true
  }
} | ConvertTo-Json -Compress
irm "$Base/api/simulate" -Method Post -ContentType "application/json" -Body $bodySafe | ConvertTo-Json -Depth 8

Write-Host "`nSimulate (BLOCK):" -ForegroundColor Cyan
$bodyBlock = @{
  mint = $Mint
  mock = @{
    mintAuthorityActive = $true
    top10HoldersPct    = 90
    freezeNotRenounced = $true
    tokenAgeDays       = 1
    liquidityLocked    = $false
    creatorReputation  = 5
    socialsOk          = $false
    bagsVerified       = $false
  }
} | ConvertTo-Json -Compress
irm "$Base/api/simulate" -Method Post -ContentType "application/json" -Body $bodyBlock | ConvertTo-Json -Depth 8

Write-Host "`nApply (mint):" -ForegroundColor Cyan
irm "$Base/api/apply" -Method Post -ContentType "application/json" -Body (@{ mint = $Mint } | ConvertTo-Json -Compress) | ConvertTo-Json -Depth 8

Write-Host "`nApply (txOnly):" -ForegroundColor Cyan
irm "$Base/api/apply" -Method Post -ContentType "application/json" -Body (@{ transactionSig = "ABCDE12345" } | ConvertTo-Json -Compress) | ConvertTo-Json -Depth 8
