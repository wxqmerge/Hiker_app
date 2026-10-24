#!/bin/bash
# Move API keys from server/.env into a protected EnvironmentFile.
# Run from an instance directory, e.g.:
#   cd /var/www/html/sothh-dev
#   sudo bash ./deploy/secure-env.sh <admin-user>

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIR="$(dirname "$SCRIPT_DIR")"
SERVICE="$(basename "$DIR")"

source "$SCRIPT_DIR/hiker-env.sh"

ENV_FILE="$DIR/server/.env"
SECRET_FILE="$(hiker_secret_file_for "$SERVICE")"
SERVICE_FILE="/etc/systemd/system/${SERVICE}.service"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found."
    exit 1
fi

TARGET_USER="${1:-${SUDO_USER:-}}"
if [ -n "$TARGET_USER" ] && [ "$TARGET_USER" != "root" ]; then
    hiker_run_as_root groupadd -f "$HIKER_SECRET_GROUP"
    if ! id -nG "$TARGET_USER" | grep -qw "$HIKER_SECRET_GROUP"; then
        hiker_run_as_root usermod -aG "$HIKER_SECRET_GROUP" "$TARGET_USER"
        echo "Added $TARGET_USER to $HIKER_SECRET_GROUP. Open a new login shell for it to take effect."
    fi
fi

ADMIN_KEY=$(hiker_read_env_value ADMIN_API_KEY "$SECRET_FILE" "$ENV_FILE" || true)
if [ -z "$ADMIN_KEY" ]; then
    echo "Error: ADMIN_API_KEY must exist in $ENV_FILE before migration."
    exit 1
fi

umask 077
BACKUP="$ENV_FILE.pre-secret.$(date +%Y%m%d%H%M%S)"
hiker_run_as_root cp -a "$ENV_FILE" "$BACKUP"
hiker_run_as_root chmod 600 "$BACKUP"

hiker_write_secret_file "$SECRET_FILE" "$ADMIN_KEY" || exit 1
hiker_remove_legacy_keys "$ENV_FILE"
hiker_run_as_root chmod 640 "$ENV_FILE"

if [ -f "$SERVICE_FILE" ]; then
    hiker_ensure_environment_file "$SERVICE_FILE" "$ENV_FILE" || echo "  WARNING: could not configure $ENV_FILE"
    hiker_ensure_environment_file "$SERVICE_FILE" "$SECRET_FILE" || echo "  WARNING: could not configure $SECRET_FILE"

    # This migration deletes the key from server/.env, so from here the only copy the
    # service can see is $SECRET_FILE: 640 root:$HIKER_SECRET_GROUP inside a 750
    # directory. The account in the unit's User= must be in that group, or systemd
    # skips the unreadable file silently (leading '-') and every admin route answers
    # 403 while the deploy reports success. The TARGET_USER added above is the
    # interactive admin, who is not necessarily the service user.
    hiker_grant_secret_access "$(hiker_service_user "$SERVICE")" "$SECRET_FILE" ||
        echo "  WARNING: could not grant the service user access to $SECRET_FILE"

    SERVER_PORT=$(hiker_read_env_value PORT "$ENV_FILE" 2>/dev/null || echo "3000")
    hiker_run_as_root systemctl daemon-reload
    if hiker_run_as_root systemctl restart "$SERVICE"; then
        echo "Service restarted: $SERVICE"
        sleep 2
        hiker_verify_admin_key_after_change "$SERVICE" "$SERVER_PORT" || VERIFY_FAILED=1
    else
        echo "Warning: keys were migrated, but service restart failed."
        echo "Fix: sudo systemctl restart $SERVICE"
        VERIFY_FAILED=1
    fi
else
    echo "Warning: $SERVICE_FILE not found; keys migrated without updating systemd."
fi

echo "Secrets stored: $SECRET_FILE"
echo "Legacy backup:  $BACKUP"
echo "server/.env permissions: 640, key line removed"

if [ "${VERIFY_FAILED:-0}" = "1" ]; then
    echo ""
    echo "The key was written, but the running service was NOT confirmed to hold it."
    echo "Trust the rotation only after this reports 401 (403 = the process has no key):"
    echo "  curl -s -w ' [%{http_code}]\n' http://localhost:${SERVER_PORT:-3000}/api/auth/verify"
    exit 1
fi
