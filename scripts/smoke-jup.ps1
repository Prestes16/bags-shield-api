# Smoke test: Swap Router v0 (contrato único)
# Valida endpoints /api/v0/swap/quote e /api/v0/swap/build
# Cobre: token comum (tem rota), token sem rota (NO_ROUTE), fee aplicado

param(
  [string]$Base = "http://localhost:3000",
  [string]$InputMint = "So11111111111111111111111111111111111111112",
  [string]$OutputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  [string]$Amount = "1000000",
  [string]$UserPubkey = "PUT_USER_PUBKEY_HERE"
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== Smoke: Swap Router v0 ===" -ForegroundColor Cyan
Write-Host "Base: $Base" -ForegroundColor Gray
Write-Host ""

$errors = 0
$warnings = 0

# === Test 1: Quote com token comum (deve ter rota) ===
Write-Host "[1/4] POST /api/v0/swap/quote (token comum)..." -ForegroundColor Yellow
try {
  $quoteBody = @{
    inputMint   = $InputMint
    outputMint  = $OutputMint
    amount      = $Amount
    slippageBps = 50
    swapMode    = "ExactIn"
  } | ConvertTo-Json -Depth 8

  $quoteRes = Invoke-RestMethod -Uri "$Base/api/v0/swap/quote" -Method POST -Body $quoteBody -ContentType "application/json" -ErrorAction Stop

  if (-not $quoteRes.success) {
    if ($quoteRes.error -eq "NO_ROUTE") {
      Write-Host "  WARNING: NO_ROUTE (pode ser normal se liquidez baixa)" -ForegroundColor Yellow
      Write-Host "  Details: $($quoteRes.details.reason)" -ForegroundColor Gray
      $warnings++
    }
    else {
      Write-Host "  ERROR: Quote failed: $($quoteRes.error)" -ForegroundColor Red
      $errors++
    }
  }
  else {
    Write-Host "  OK quote, provider=$($quoteRes.response.provider), requestId=$($quoteRes.meta.requestId)" -ForegroundColor Green
    Write-Host "  Fee: $($quoteRes.response.fee.feeBps) bps" -ForegroundColor Gray
    if ($quoteRes.response.fee.feeAccount) {
      Write-Host "  FeeAccount: $($quoteRes.response.fee.feeAccount.Substring(0,8))..." -ForegroundColor Gray
    }
    $quote = $quoteRes
  }
}
catch {
  Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
  $errors++
}

# === Test 2: Quote com token inexistente (deve retornar NO_ROUTE) ===
Write-Host "`n[2/4] POST /api/v0/swap/quote (token sem rota)..." -ForegroundColor Yellow
try {
  $badQuoteBody = @{
    inputMint   = "11111111111111111111111111111111"
    outputMint  = "22222222222222222222222222222222"
    amount      = "1000"
    slippageBps = 50
  } | ConvertTo-Json -Depth 8

  $badQuoteRes = Invoke-RestMethod -Uri "$Base/api/v0/swap/quote" -Method POST -Body $badQuoteBody -ContentType "application/json" -ErrorAction Stop

  if ($badQuoteRes.success) {
    Write-Host "  WARNING: Esperava NO_ROUTE mas recebeu success" -ForegroundColor Yellow
    $warnings++
  }
  elseif ($badQuoteRes.error -eq "NO_ROUTE") {
    Write-Host "  OK NO_ROUTE (esperado)" -ForegroundColor Green
    Write-Host "  Provider tried: $($badQuoteRes.details.providerTried -join ', ')" -ForegroundColor Gray
    Write-Host "  Next actions: $($badQuoteRes.details.nextActions -join ', ')" -ForegroundColor Gray
  }
  else {
    Write-Host "  ERROR: Esperava NO_ROUTE mas recebeu $($badQuoteRes.error)" -ForegroundColor Red
    $errors++
  }
}
catch {
  Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
  $errors++
}

# === Test 3: Build swap (se quote disponível) ===
Write-Host "`n[3/4] POST /api/v0/swap/build..." -ForegroundColor Yellow
try {
  if (-not $quote -or -not $quote.success) {
    Write-Host "  SKIP: Quote não disponível" -ForegroundColor Yellow
    $warnings++
  }
  else {
    if ($UserPubkey -eq "PUT_USER_PUBKEY_HERE") {
      Write-Host "  WARNING: UserPubkey não configurado (use -UserPubkey)" -ForegroundColor Yellow
      Write-Host "  Usando pubkey de exemplo..." -ForegroundColor Gray
      $UserPubkey = "11111111111111111111111111111111"
    }

    $buildBody = @{
      quoteResponse   = $quote.response.quote
      userPublicKey   = $UserPubkey
      feeAccount      = $quote.response.fee.feeAccount
      trackingAccount = $quote.response.fee.trackingAccount
    } | ConvertTo-Json -Depth 30

    $buildRes = Invoke-RestMethod -Uri "$Base/api/v0/swap/build" -Method POST -Body $buildBody -ContentType "application/json" -ErrorAction Stop

    if (-not $buildRes.success) {
      Write-Host "  ERROR: Build failed: $($buildRes.error)" -ForegroundColor Red
      $errors++
    }
    else {
      if (-not $buildRes.response.swapTransaction) {
        Write-Host "  ERROR: No swapTransaction returned" -ForegroundColor Red
        $errors++
      }
      else {
        $txLen = $buildRes.response.swapTransaction.Length
        Write-Host "  OK swapTransaction length=$txLen, provider=$($buildRes.response.provider)" -ForegroundColor Green
        Write-Host "  Latency: $($buildRes.meta.latency)ms" -ForegroundColor Gray
      }
    }
  }
}
catch {
  Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
  $errors++
}

# === Test 4: Fee aplicado (verificar que fee vem no quote) ===
Write-Host "`n[4/4] Verificar fee aplicado..." -ForegroundColor Yellow
try {
  if ($quote -and $quote.success) {
    $feeBps = $quote.response.fee.feeBps
    if ($feeBps -gt 0) {
      Write-Host "  OK Fee aplicado: $feeBps bps" -ForegroundColor Green
      if ($quote.response.fee.feeAccount) {
        Write-Host "  FeeAccount configurado" -ForegroundColor Green
      }
      else {
        Write-Host "  WARNING: FeeAccount não configurado (pode ser normal se optOut)" -ForegroundColor Yellow
        $warnings++
      }
    }
    else {
      Write-Host "  INFO: Fee = 0 (optOut ou config)" -ForegroundColor Gray
    }
  }
  else {
    Write-Host "  SKIP: Quote não disponível" -ForegroundColor Yellow
    $warnings++
  }
}
catch {
  Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
  $errors++
}

# === Summary ===
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Errors: $errors" -ForegroundColor $(if ($errors -eq 0) { "Green" } else { "Red" })
Write-Host "Warnings: $warnings" -ForegroundColor $(if ($warnings -eq 0) { "Green" } else { "Yellow" })
if ($errors -eq 0) {
  Write-Host "PASS: Swap Router v0 smoke checks completed" -ForegroundColor Green
}
else {
  Write-Host "FAIL: $errors error(s)" -ForegroundColor Red
}
exit $errors
