$ErrorActionPreference = "Stop"

Write-Host "[worktree] setup start"

# Install dependencies
if (Test-Path "package-lock.json") {
  Write-Host "[worktree] npm ci"
  npm ci
} else {
  Write-Host "[worktree] npm install"
  npm install
}

# Copy env files from the root worktree path (if available)
$root = $env:ROOT_WORKTREE_PATH
if (![string]::IsNullOrWhiteSpace($root)) {
  $rootEnv = Join-Path $root ".env"
  $rootEnvExample = Join-Path $root ".env.example"
  $rootEnvLocal = Join-Path $root ".env.local"

  if (!(Test-Path ".env")) {
    if (Test-Path $rootEnv) {
      Write-Host "[worktree] copying .env from ROOT_WORKTREE_PATH"
      Copy-Item $rootEnv ".env" -Force
    } elseif (Test-Path $rootEnvExample) {
      Write-Host "[worktree] copying .env.example -> .env"
      Copy-Item $rootEnvExample ".env" -Force
    } else {
      Write-Host "[worktree] no .env/.env.example found in root; skipping"
    }
  } else {
    Write-Host "[worktree] .env already exists; skipping"
  }

  if (!(Test-Path ".env.local") -and (Test-Path $rootEnvLocal)) {
    Write-Host "[worktree] copying .env.local"
    Copy-Item $rootEnvLocal ".env.local" -Force
  }
} else {
  Write-Host "[worktree] ROOT_WORKTREE_PATH not set; skipping env copy"
}

Write-Host "[worktree] setup complete"
