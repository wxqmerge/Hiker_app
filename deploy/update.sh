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
DEPLOY_USER="$(whoami)"
DEPLOY_GROUP="$(id -gn "$DEPLOY_USER" 2>/dev/null || echo "$DEPLOY_USER")"

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
echo "[1/10] Stashing local changes..."
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
echo "[2/10] Pulling latest code..."
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
echo "[3/10] Validating API keys..."
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

if grep -q '^PORT=' "$ENV_FILE"; then
    SERVER_PORT=$(grep '^PORT=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '[:space:]')
else
    SERVER_PORT=3000
fi
echo "  PORT: $SERVER_PORT"

# 4. Clean stale build artifacts
echo "[4/10] Cleaning stale build artifacts..."
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
echo "[5/10] Installing frontend dependencies..."
INSTALL_DEPS=false
if [ -f "package.json" ]; then
    if [ ! -d "node_modules" ]; then
        echo "  node_modules missing — must install."
        INSTALL_DEPS=true
    else
        cooldown_type="normal"
        if [ "$FORCE_CRITICAL" = true ]; then
            cooldown_type="critical"
            echo "  WARNING: Using critical security patch cooldown (2 days)"
        fi
        if check_package_cooldown "$cooldown_type"; then
            INSTALL_DEPS=true
        else
            last_update=$(time_since_last_update)
            echo "  Skipped npm install - package cooldown active (last updated: $last_update)"
        fi
    fi
    if [ "$INSTALL_DEPS" = true ]; then
        if ! npm install; then
            echo "  ERROR: Frontend npm install failed."
            exit 1
        fi
        echo "  Dependencies installed."
    fi
fi

echo "[6/10] Installing server dependencies..."
if [ -f "server/package.json" ]; then
    if [ ! -d "server/node_modules" ]; then
        echo "  server/node_modules missing — must install."
        INSTALL_DEPS=true
    fi
    if [ "$INSTALL_DEPS" = true ]; then
        if ! (cd server && npm install); then
            echo "  ERROR: Server npm install failed."
            exit 1
        fi
        echo "  Server dependencies installed."
    else
        echo "  Skipped - package cooldown active."
    fi
fi
if [ "$INSTALL_DEPS" = true ]; then
    record_package_update
fi

echo "[7/10] Building frontend + server..."
if ! npm run build:all; then
    echo "  ERROR: Build failed."
    echo "  Aborting. Check build output above."
    exit 1
fi
echo "  Build complete."

# 8. Fix systemd service file
echo "[8/10] Fixing systemd service file if needed..."
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
    echo "  WARNING: $SERVICE_FILE not found — creating from template"
    TEMPLATE="$DEPLOY_DIR/hiker-app.service"
    if [ -f "$TEMPLATE" ]; then
        sed "s|/var/www/html/hiker-app|$DIR|g; s|User=hiker|User=$DEPLOY_USER|g; s|Group=hiker|Group=$DEPLOY_GROUP|g" "$TEMPLATE" | sudo tee "$SERVICE_FILE" > /dev/null
        echo "  Created $SERVICE_FILE"
    else
        echo "  ERROR: Template $TEMPLATE not found"
        exit 1
    fi
fi
echo "  Reloading systemd daemon..."
sudo -n systemctl daemon-reload 2>&1 || echo "  WARNING: systemctl daemon-reload failed."

# 9. Apply nginx config
echo "[9/10] Applying nginx config..."
NGINX_CONF="/etc/nginx/sites-available/$SERVICE"
if [ -f "$NGINX_CONF" ]; then
    if ! grep -q "server_name $DOMAIN" "$NGINX_CONF"; then
        sudo sed -i "s/server_name .*/server_name $DOMAIN;/" "$NGINX_CONF"
        echo "  Updated server_name to $DOMAIN"
    fi
    if ! grep -q "proxy_pass.*localhost:$SERVER_PORT" "$NGINX_CONF"; then
        sudo sed -i "s|proxy_pass http://localhost:[0-9]*;|proxy_pass http://localhost:$SERVER_PORT;|" "$NGINX_CONF"
        echo "  Updated proxy_pass to localhost:$SERVER_PORT"
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
    sudo sed -i "s|proxy_pass http://localhost:3000;|proxy_pass http://localhost:$SERVER_PORT;|" "$NGINX_CONF"
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
echo "[10/10] Restarting service: $SERVICE"
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
