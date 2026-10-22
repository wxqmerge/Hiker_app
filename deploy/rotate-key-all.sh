#!/bin/bash
# Rotate API key across ALL app instances on the server
# Run from: /var/www/html/
# Usage:
#   ./deploy/rotate-key-all.sh
#   ROTATE_KEY=... ./deploy/rotate-key-all.sh
#
# Never pass a key as a command-line argument. If ROTATE_KEY is unset, the script
# reads it from a hidden prompt or generates one.
#
# If /etc/hiker/<instance>.env exists, the key is written there (root/group
# protected). Otherwise the legacy server/.env is updated. The new key is
# written to a mode-0600 report file.

BASE="/var/www/html"
OK=0
FAIL=0
SKIP=0

umask 077
if [ -n "${SUDO_USER:-}" ]; then
    REPORT_USER="$SUDO_USER"
else
    REPORT_USER="${USER:-$(id -un)}"
fi
REPORT_HOME="$(getent passwd "$REPORT_USER" 2>/dev/null | cut -d: -f6)"
[ -n "$REPORT_HOME" ] || REPORT_HOME="$HOME"
REPORT_FILE="$REPORT_HOME/hiker-rotated-key-$(date +%Y%m%d%H%M%S).txt"
: > "$REPORT_FILE"
if [ -n "${SUDO_USER:-}" ]; then
    chown "$SUDO_USER:$SUDO_USER" "$REPORT_FILE" 2>/dev/null || true
fi

# Detect the project repo from the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/hiker-env.sh"
CALLER_REMOTE=$(git -C "$SCRIPT_DIR" remote get-url origin 2>/dev/null)
CALLER_REPO=$(basename "$CALLER_REMOTE" .git)

if [ -z "$CALLER_REPO" ]; then
    echo "Error: could not detect git repo from $SCRIPT_DIR"
    echo "This script must be run from within a project directory."
    exit 1
fi

if [ -n "${1:-}" ]; then
    echo "Error: do not pass an API key as a command-line argument."
    echo "Run interactively, or set ROTATE_KEY in a protected environment."
    exit 1
fi

NEW_KEY="${ROTATE_KEY:-}"
if [ -z "$NEW_KEY" ] && [ -t 0 ]; then
    read -rsp "New admin key (Enter to generate): " NEW_KEY
    echo ""
fi
if [ -z "$NEW_KEY" ]; then
    NEW_KEY=$(openssl rand -hex 48)
fi

echo "========================================"
echo "  Rotate API Key — ALL $CALLER_REPO Instances"
echo "  Base: $BASE"
echo "  Report: $REPORT_FILE"
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
    SECRET_FILE="$(hiker_secret_file_for "$name")"
    if [ ! -f "$ENV_FILE" ]; then
        echo "  ✗ $name — $ENV_FILE not found, skipping"
        FAIL=$((FAIL + 1))
        echo ""
        continue
    fi

    if [ -f "$SECRET_FILE" ]; then
        if hiker_write_secret_file "$SECRET_FILE" "$NEW_KEY" &&
           hiker_remove_legacy_keys "$ENV_FILE"; then
            chmod 640 "$ENV_FILE" 2>/dev/null || hiker_run_as_root chmod 640 "$ENV_FILE" 2>/dev/null || true
            echo "  ✓ $name — protected key updated"
        else
            echo "  ✗ $name — protected key update failed"
            FAIL=$((FAIL + 1))
            echo ""
            continue
        fi
    else
        if ! hiker_write_env_value ADMIN_API_KEY "$NEW_KEY" "$ENV_FILE"; then
            echo "  ✗ $name — legacy key update failed"
            FAIL=$((FAIL + 1))
            echo ""
            continue
        fi
        echo "  ✓ $name — legacy key updated"
    fi

    # Restart the service
    SERVICE="$name"
    if sudo systemctl restart "$SERVICE" 2>/dev/null; then
        echo "  ✓ $name — service restarted"
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
echo ""

{
    echo "========================================"
    echo "  Rotated API Key"
    echo "  Generated: $(date '+%Y-%m-%d %H:%M')"
    echo "========================================"
    echo ""
    echo "ADMIN_API_KEY=$NEW_KEY"
    echo ""
    echo "Delete this file after copying the key to your password manager."
} > "$REPORT_FILE"

chmod 600 "$REPORT_FILE" 2>/dev/null || true
echo "New key report written to:"
echo "  $REPORT_FILE"
echo "Delete it securely after copying the key: shred -u $REPORT_FILE"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
