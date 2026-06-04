#!/bin/bash

# Update and restart the Hiker server
# Usage: ./update.sh [service-name] [--force|--force-critical]
#   --force          Bypass all cooldowns and force package update
#   --force-critical Force package update for critical security patches (2-day cooldown)

# Don't exit on error - keep SSH session alive
# We handle errors manually below

# Parse command-line flags first (before SERVICE assignment)
FORCE_UPDATE=false
FORCE_CRITICAL=false
SERVICE_NAME=""

for arg in "$@"; do
    case $arg in
        --force)
            FORCE_UPDATE=true
            ;;
        --force-critical)
            FORCE_CRITICAL=true
            ;;
        -*)
            echo "Unknown flag: $arg"
            echo "Usage: $0 [service-name] [--force|--force-critical]"
            exit 1
            ;;
        *)
            if [ -z "$SERVICE_NAME" ]; then
                SERVICE_NAME="$arg"
            fi
            ;;
    esac
done

# Load local deployment config
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$DEPLOY_DIR/.env" ]; then
    source "$DEPLOY_DIR/.env"
fi

SERVICE="${SERVICE_NAME:-${SERVICE_NAME:-$(basename "$PWD")}}"
DIR="$(pwd)"

# Dependency cooldown configuration
LAST_PACKAGE_UPDATE_FILE="$DIR/.last-package-update"
PACKAGE_COOLDOWN_NORMAL=604800    # 7 days in seconds
PACKAGE_COOLDOWN_CRITICAL=172800  # 2 days in seconds

check_package_cooldown() {
    local cooldown_type="${1:-normal}"
    local cooldown_seconds

    if [ "$cooldown_type" = "critical" ]; then
        cooldown_seconds=$PACKAGE_COOLDOWN_CRITICAL
    else
        cooldown_seconds=$PACKAGE_COOLDOWN_NORMAL
    fi

    if [ ! -f "$LAST_PACKAGE_UPDATE_FILE" ]; then
        return 0
    fi

    if [ "$FORCE_UPDATE" = true ]; then
        return 0
    fi

    if [ "$FORCE_CRITICAL" = true ] && [ "$cooldown_type" = "critical" ]; then
        return 0
    fi

    local last_update
    last_update=$(stat -c %Y "$LAST_PACKAGE_UPDATE_FILE" 2>/dev/null || echo 0)
    local now
    now=$(date +%s)
    local diff=$((now - last_update))

    if [ "$diff" -ge "$cooldown_seconds" ]; then
        return 0
    fi

    return 1
}

record_package_update() {
    date +%s > "$LAST_PACKAGE_UPDATE_FILE"
}

time_since_last_update() {
    if [ ! -f "$LAST_PACKAGE_UPDATE_FILE" ]; then
        echo "never"
        return
    fi
    local last_update
    last_update=$(stat -c %Y "$LAST_PACKAGE_UPDATE_FILE" 2>/dev/null || echo 0)
    local now
    now=$(date +%s)
    local diff=$((now - last_update))
    local days=$((diff / 86400))
    local hours=$(( (diff % 86400) / 3600 ))
    echo "${days}d ${hours}h ago"
}

echo "=== Updating $SERVICE ==="
echo "Directory: $DIR"
echo "Service:   $SERVICE"
echo ""
echo "To trace live logs: sudo journalctl -u $SERVICE -f"
echo ""

# 1. Stash any local changes
echo "[1/9] Stashing local changes..."
if ! git diff --quiet 2>/dev/null; then
    if git stash; then
        echo "  Changes stashed."
    else
        echo "  ERROR: Failed to stash changes."
        echo "  Aborting. Fix your local changes and try again."
        exit 1
    fi
else
    echo "  No local changes to stash."
fi

# 2. Pull latest code
echo "[2/8] Pulling latest code..."
if git pull --rebase 2>/dev/null; then
    echo "  Pulled successfully."
elif git fetch origin main && git reset --hard origin/main; then
    echo "  Branches diverged — reset to origin/main."
else
    echo "  ERROR: Failed to update from remote. Restoring stash..."
    git stash pop 2>/dev/null || true
    echo "  Aborting."
    exit 1
fi

# 3. Validate API keys
echo "[3/8] Validating API keys..."
ENV_FILE="$DIR/server/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "  ERROR: $ENV_FILE not found."
    echo "  API key (ADMIN_API_KEY) is required for production."
    echo "  Copy server/.env.example to server/.env and set your key."
    exit 1
fi
if grep -q '^ADMIN_API_KEY=' "$ENV_FILE"; then
    ADMIN_KEY=$(grep '^ADMIN_API_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '[:space:]')
else
    ADMIN_KEY=""
fi
if [ -z "$ADMIN_KEY" ]; then
    echo "  ERROR: ADMIN_API_KEY must be set in server/.env."
    echo "  Deploy aborted. Set the key and try again."
    exit 1
fi
echo "  ADMIN_API_KEY: (set)"

DOMAIN="$(basename "$DIR").example.com"
echo "  DOMAIN: $DOMAIN"

# 4. Clean stale build artifacts
echo "[4/8] Cleaning stale build artifacts..."
if [ -d "dist" ]; then
    rm -rf dist
    echo "  Removed dist/"
fi
if [ -d "server/dist" ]; then
    rm -rf server/dist
    echo "  Removed server/dist/"
fi
if [ -d "shared/types" ]; then
    rm -f shared/types/*.js shared/types/*.js.map shared/types/*.d.ts shared/types/*.d.ts.map
    echo "  Removed stale shared/types/*.js"
fi

# 5. Install frontend dependencies and build
echo "[5/8] Installing frontend dependencies..."
if [ -f "package.json" ]; then
    cooldown_type="normal"
    if [ "$FORCE_CRITICAL" = true ]; then
        cooldown_type="critical"
        echo "  WARNING: Using critical security patch cooldown (2 days)"
    fi
    if check_package_cooldown "$cooldown_type"; then
        if ! npm install; then
            echo "  ERROR: Frontend npm install failed."
            exit 1
        fi
        record_package_update
        echo "  Dependencies installed."
    else
        last_update=$(time_since_last_update)
        echo "  Skipped npm install - package cooldown active (last updated: $last_update)"
    fi
fi

echo "[6/8] Building frontend + server..."
if ! npm run build:all; then
    echo "  ERROR: Build failed."
    echo "  Aborting. Check build output above."
    exit 1
fi
echo "  Build complete."

# 7. Fix systemd service file
echo "[7/8] Fixing systemd service file if needed..."
SERVICE_FILE="/etc/systemd/system/$SERVICE.service"
if [ -f "$SERVICE_FILE" ]; then
    HAS_ENV_FILE=$(grep -c '^EnvironmentFile=' "$SERVICE_FILE" || true)
    if [ "$HAS_ENV_FILE" -gt 0 ]; then
        SERVICE_SECTION=$(sed -n '/^\[Service\]/,/^$/p' "$SERVICE_FILE")
        if echo "$SERVICE_SECTION" | grep -q '^EnvironmentFile='; then
            echo "  EnvironmentFile is correctly placed in [Service] section."
        else
            echo "  WARNING: EnvironmentFile found but NOT in [Service] section — fixing..."
            sudo sh -c "sed -i '/^EnvironmentFile=/d' $SERVICE_FILE"
            ENV_FILE="$DIR/server/.env"
            if [ -f "$ENV_FILE" ]; then
                EXEC_LINE=$(grep -n '^ExecStart=' "$SERVICE_FILE" | head -1 | cut -d: -f1)
                if [ -n "$EXEC_LINE" ] && [ "$EXEC_LINE" -gt 1 ]; then
                    INSERT_LINE=$((EXEC_LINE - 1))
                    sudo sh -c "sed -i '${INSERT_LINE}a EnvironmentFile=$ENV_FILE' $SERVICE_FILE"
                    echo "  Injected EnvironmentFile into [Service] section"
                fi
            fi
        fi
    else
        echo "  No EnvironmentFile found — adding it."
        ENV_FILE="$DIR/server/.env"
        if [ -f "$ENV_FILE" ]; then
            EXEC_LINE=$(grep -n '^ExecStart=' "$SERVICE_FILE" | head -1 | cut -d: -f1)
            if [ -n "$EXEC_LINE" ] && [ "$EXEC_LINE" -gt 1 ]; then
                INSERT_LINE=$((EXEC_LINE - 1))
                sudo sh -c "sed -i '${INSERT_LINE}a EnvironmentFile=$ENV_FILE' $SERVICE_FILE"
                echo "  Injected EnvironmentFile into [Service] section"
            fi
        fi
    fi
    echo "  Reloading systemd daemon..."
    sudo -n systemctl daemon-reload 2>&1 || echo "  WARNING: systemctl daemon-reload failed."
else
    echo "  WARNING: $SERVICE_FILE not found"
fi

# 8. Apply nginx config
echo "[8/9] Applying nginx config..."
NGINX_CONF="/etc/nginx/sites-available/$SERVICE"
if [ -f "$NGINX_CONF" ]; then
    if ! grep -q "server_name $DOMAIN" "$NGINX_CONF"; then
        sudo sed -i "s/server_name .*/server_name $DOMAIN;/" "$NGINX_CONF"
        echo "  Updated server_name to $DOMAIN"
    else
        echo "  server_name already correct"
    fi
    if sudo nginx -t 2>&1 | grep -q "syntax is ok"; then
        sudo systemctl reload nginx
        echo "  Nginx reloaded."
    else
        echo "  ERROR: Nginx config test failed."
        exit 1
    fi
else
    echo "  WARNING: $NGINX_CONF not found — copying from deploy/hiker.conf"
    sudo cp deploy/hiker.conf "$NGINX_CONF"
    sudo sed -i "s/server_name .*/server_name $DOMAIN;/" "$NGINX_CONF"
    NGINX_ENABLED="/etc/nginx/sites-enabled/$SERVICE"
    if [ ! -f "$NGINX_ENABLED" ]; then
        sudo ln -s "$NGINX_CONF" "$NGINX_ENABLED"
        echo "  Enabled site."
    fi
    if sudo nginx -t 2>&1 | grep -q "syntax is ok"; then
        sudo systemctl reload nginx
        echo "  Nginx reloaded."
    else
        echo "  ERROR: Nginx config test failed."
        exit 1
    fi
fi

# 9. Restart service
echo "[8/8] Restarting service: $SERVICE"
if ! sudo -n systemctl restart "$SERVICE" 2>&1; then
    echo "  ERROR: systemctl restart failed."
    echo "  If this says 'sudo: a password is required', you need passwordless sudo."
    exit 1
fi

sleep 2
if sudo systemctl is-active --quiet "$SERVICE"; then
    echo ""
    echo "=== Update complete. $SERVICE is running. ==="
    echo ""
    echo "To trace live logs: sudo journalctl -u $SERVICE -f"
else
    echo ""
    echo "=== WARNING: $SERVICE is NOT running! Check status: ==="
    echo "  sudo systemctl status $SERVICE"
    echo "  sudo journalctl -u $SERVICE --no-pager -n 20"
    exit 1
fi
