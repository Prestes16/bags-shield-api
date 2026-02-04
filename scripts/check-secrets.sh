#!/bin/bash
# Secrets Scanning Script using TruffleHog
# Checks staged files for secrets before committing

set -e

echo "🔐 Checking for secrets in staged files..."

# Find TruffleHog binary
TRUFFLEHOG_CMD=""

# 1. Check if TRUFFLEHOG_PATH environment variable is set
if [ -n "$TRUFFLEHOG_PATH" ] && [ -f "$TRUFFLEHOG_PATH" ]; then
    TRUFFLEHOG_CMD="$TRUFFLEHOG_PATH"
    echo "📦 Using bundled TruffleHog: $TRUFFLEHOG_PATH"

# 2. Check for VS Code extension bundled binary in globalStorage (correct location)
# VSCode stores extension data in:
#   - macOS: ~/Library/Application Support/Code/User/globalStorage
#   - Linux: ~/.config/Code/User/globalStorage
#   - Windows: %APPDATA%/Code/User/globalStorage
elif [ -d "$HOME/Library/Application Support/Code/User/globalStorage" ]; then
    # macOS
    TRUFFLEHOG_CMD=$(find "$HOME/Library/Application Support/Code/User/globalStorage/hardik2801.gokwik-linting-vscode/bin" -name "trufflehog" 2>/dev/null | head -1)
    if [ -n "$TRUFFLEHOG_CMD" ] && [ -f "$TRUFFLEHOG_CMD" ]; then
        echo "📦 Using bundled TruffleHog (macOS): $TRUFFLEHOG_CMD"
    else
        TRUFFLEHOG_CMD=""
    fi
elif [ -d "$HOME/.config/Code/User/globalStorage" ]; then
    # Linux
    TRUFFLEHOG_CMD=$(find "$HOME/.config/Code/User/globalStorage/hardik2801.gokwik-linting-vscode/bin" -name "trufflehog" 2>/dev/null | head -1)
    if [ -n "$TRUFFLEHOG_CMD" ] && [ -f "$TRUFFLEHOG_CMD" ]; then
        echo "📦 Using bundled TruffleHog (Linux): $TRUFFLEHOG_CMD"
    else
        TRUFFLEHOG_CMD=""
    fi
fi

# 3. Check for system installation if bundled version not found
if [ -z "$TRUFFLEHOG_CMD" ] && command -v trufflehog &> /dev/null; then
    TRUFFLEHOG_CMD="trufflehog"
    echo "📦 Using system TruffleHog"
fi

# 4. If still not found, exit with error
if [ -z "$TRUFFLEHOG_CMD" ]; then
    echo "❌ TruffleHog is not installed!"
    echo ""
    echo "TruffleHog should have been installed automatically by the GoKwik extension."
    echo ""
    echo "If it's missing, please reinstall by running:"
    echo "  - Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)"
    echo "  - Run: 'GoKwik: Setup Linting & Formatting'"
    echo ""
    echo "Or install manually:"
    echo "  macOS (Homebrew): brew install trufflehog"
    echo "  Linux: curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sh -s -- -b /usr/local/bin"
    echo ""
    exit 1
fi

# Get list of staged files
staged_files=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)

if [ -z "$staged_files" ]; then
    echo "ℹ️  No staged files to check"
    exit 0
fi

# Count staged files
file_count=$(echo "$staged_files" | wc -l | tr -d ' ')
echo "📊 Scanning $file_count staged file(s)..."

# Create a temporary file list
temp_file=$(mktemp)
echo "$staged_files" > "$temp_file"

# Run TruffleHog on staged files only
# Using filesystem mode with specific files
secrets_found=0
first_secret=1

while IFS= read -r file; do
    if [ -f "$file" ]; then
        # Run trufflehog on the specific file
        if "$TRUFFLEHOG_CMD" filesystem "$file" --json --no-update 2>/dev/null | grep -q "Raw"; then
            if [ $first_secret -eq 1 ]; then
                echo ""
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo "❌ SECRETS DETECTED IN STAGED FILES!"
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                first_secret=0
            fi
            echo ""
            echo "📁 File: $file"
            # Show findings in a readable format
            "$TRUFFLEHOG_CMD" filesystem "$file" --json --no-update 2>/dev/null | \
                jq -r 'select(.Raw != null) | "  🔴 Detector: \(.DetectorName)\n  🔍 Secret Found: \(.Raw[:50])...\n  📍 Line: (check file for exact location)"' 2>/dev/null || \
                echo "  ⚠️  Secret detected (install jq for detailed output)"
            secrets_found=1
        fi
    fi
done <<< "$staged_files"

# If secrets were found in the file-by-file scan, exit immediately
if [ $secrets_found -eq 1 ]; then
    echo ""
    echo "What to do:"
    echo "  1. Remove the secrets from your staged changes"
    echo "  2. Use environment variables instead"
    echo "  3. Consider using: git reset HEAD <file>"
    echo ""
    echo "Common secret types:"
    echo "  • API keys (AWS, GCP, Azure, etc.)"
    echo "  • Database passwords"
    echo "  • Private keys (SSH, JWT, etc.)"
    echo "  • OAuth tokens"
    echo "  • Webhook URLs with secrets"
    echo ""
    rm -f "$temp_file"
    exit 1
fi

# Check the exit status from the subshell
if "$TRUFFLEHOG_CMD" filesystem . --since-commit HEAD --json --no-update --only-verified 2>/dev/null | grep -q "Raw"; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ VERIFIED SECRETS FOUND IN STAGED FILES!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🚨 Critical: Verified secrets were detected!"
    echo ""
    echo "What to do:"
    echo "  1. Remove the secrets from your code"
    echo "  2. Use environment variables or secret management tools"
    echo "  3. Never commit API keys, passwords, or tokens"
    echo ""
    echo "To bypass this check (NOT RECOMMENDED):"
    echo "  git commit --no-verify"
    echo ""
    rm -f "$temp_file"
    exit 1
fi

# Cleanup
rm -f "$temp_file"

# Alternative approach: scan git diff for staged changes
echo ""
echo "🔍 Running deep scan on staged changes..."

# Get the staged changes and scan them
if git diff --cached | "$TRUFFLEHOG_CMD" git file:///dev/stdin --since-commit HEAD --json --no-update 2>/dev/null | grep -q "Raw"; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ SECRETS DETECTED IN STAGED CHANGES!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Show details
    git diff --cached | "$TRUFFLEHOG_CMD" git file:///dev/stdin --since-commit HEAD --json --no-update 2>/dev/null | \
        jq -r 'select(.Raw != null) | "\n📁 File: \(.SourceMetadata.Data.Git.file // "unknown")\n  🔴 Detector: \(.DetectorName)\n  🔍 Secret Type: \(.DetectorName)\n  ⚠️  Action Required: Remove this secret before committing\n"' 2>/dev/null || \
        echo "⚠️  Secrets found (install jq for detailed output)"

    echo ""
    echo "What to do:"
    echo "  1. Remove the secrets from your staged changes"
    echo "  2. Use environment variables instead"
    echo "  3. Consider using: git reset HEAD <file>"
    echo ""
    echo "Common secret types:"
    echo "  • API keys (AWS, GCP, Azure, etc.)"
    echo "  • Database passwords"
    echo "  • Private keys (SSH, JWT, etc.)"
    echo "  • OAuth tokens"
    echo "  • Webhook URLs with secrets"
    echo ""
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ No secrets detected in staged files!"
echo "🎉 Safe to commit"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit 0
