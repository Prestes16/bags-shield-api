#!/usr/bin/env bash
set -euo pipefail

echo "[worktree] setup start"

# Install dependencies
if [ -f "package-lock.json" ]; then
  echo "[worktree] npm ci"
  npm ci
else
  echo "[worktree] npm install"
  npm install
fi

# Copy env files from root worktree path if available
if [ -n "${ROOT_WORKTREE_PATH:-}" ]; then
  if [ ! -f ".env" ]; then
    if [ -f "$ROOT_WORKTREE_PATH/.env" ]; then
      echo "[worktree] copying .env from ROOT_WORKTREE_PATH"
      cp "$ROOT_WORKTREE_PATH/.env" .env
    elif [ -f "$ROOT_WORKTREE_PATH/.env.example" ]; then
      echo "[worktree] copying .env.example -> .env"
      cp "$ROOT_WORKTREE_PATH/.env.example" .env
    else
      echo "[worktree] no .env/.env.example found in root; skipping"
    fi
  else
    echo "[worktree] .env already exists; skipping"
  fi

  if [ ! -f ".env.local" ] && [ -f "$ROOT_WORKTREE_PATH/.env.local" ]; then
    echo "[worktree] copying .env.local"
    cp "$ROOT_WORKTREE_PATH/.env.local" .env.local
  fi
else
  echo "[worktree] ROOT_WORKTREE_PATH not set; skipping env copy"
fi

echo "[worktree] setup complete"
