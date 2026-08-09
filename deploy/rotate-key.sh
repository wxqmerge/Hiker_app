#!/bin/bash
# Rotate API key across all app instances from the same git repository
# Run from: /var/www/html/
# Usage: ./deploy/rotate-key.sh [new-key]
#
# If no key is provided, generates a random 96-char hex key.

BASE="/var/www/html"
OK=0
FAIL=0
SKIP=0

# Detect the project repo from the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CALLER_REMOTE=$(git -C "$SCRIPT_DIR" remote get-url origin 2>/dev/null)
CALLER_REPO=$(basename "$CALLER_REMOTE" .git)

if [ -z "$CALLER_REPO" ]; then
    echo "Error: could not detect git repo from $SCRIPT_DIR"
    echo "This script must be run from within a project directory."
    exit 1
fi

# Generate or use provided key
if [ -n "$1" ]; then
    NEW_KEY="$1"
else
    NEW_KEY=$(openssl rand -hex 48)
fi

echo "========================================"
echo "  Rotate API Key — $CALLER_REPO Instances"
echo "  Base: $BASE"
echo "  Key:  $NEW_KEY"
echo "========================================"
echo ""

for dir in "$BASE"/*/; do
    [ -d "$dir" ] || continue
    name=$(basename "$dir")

    # Must be a git repository
    if ! git -C "$dir" remote -v &>/dev/null; then
        echo "  ⊘ $name — not a git repo, skipping"
        SKIP=$((SKIP + 1))
        echo ""
        continue
    fi

    # Detect repo from remote origin — must match calling project
    remote=$(git -C "$dir" remote get-url origin 2>/dev/null)
    repo=$(basename "$remote" .git)

    if [ "$repo" != "$CALLER_REPO" ]; then
        echo "  ⊘ $name — different repo ($repo), skipping"
        SKIP=$((SKIP + 1))
        echo ""
        continue
    fi

    ENV_FILE="$dir/server/.env"
    if [ ! -f "$ENV_FILE" ]; then
        echo "  ✗ $name — $ENV_FILE not found, skipping"
        FAIL=$((FAIL + 1))
        echo ""
        continue
    fi

    # Update the key
    if grep -q '^ADMIN_API_KEY=' "$ENV_FILE"; then
        sed -i "s/^ADMIN_API_KEY=.*/ADMIN_API_KEY=$NEW_KEY/" "$ENV_FILE"
    else
        echo "ADMIN_API_KEY=$NEW_KEY" >> "$ENV_FILE"
    fi

    # Restart the service
    SERVICE="$name"
    if sudo systemctl restart "$SERVICE" 2>/dev/null; then
        echo "  ✓ $name — key updated, service restarted"
        OK=$((OK + 1))
    else
        echo "  ⚠ $name — key updated, but service restart failed"
        echo "    Fix: sudo systemctl restart $SERVICE"
        OK=$((OK + 1))
    fi
    echo ""
done

echo "========================================"
echo "  Done: $OK OK, $FAIL failed, $SKIP skipped"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
