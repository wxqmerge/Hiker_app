#!/bin/bash

# Update and restart the Hiker server
# Usage: ./update.sh [service-name] [--force|--force-critical]
#   --force          Bypass all cooldowns and force package update
#   --force-critical Force package update for critical security patches (2-day cooldown)

# Self-fix: restore execute permission if stripped by Windows
SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
if [ ! -x "$SCRIPT_PATH" ]; then
    sudo chmod +x "$SCRIPT_PATH"
fi

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

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"

# Service name defaults to current directory name
SERVICE="${SERVICE_NAME:-$(basename "$PWD")}"
DIR="$(pwd)"
DEPLOY_USER="$(whoami)"
DEPLOY_GROUP="$(id -gn "$DEPLOY_USER" 2>/dev/null || echo "$DEPLOY_USER")"
SHARED_GROUP="www-data"

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
echo "[1/13] Stashing local changes..."
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
echo "[2/13] Pulling latest code..."
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
echo "[3/13] Validating API keys..."
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
echo "[4/13] Cleaning stale build artifacts..."
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
echo "[5/13] Installing frontend dependencies..."
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

echo "[6/13] Installing server dependencies..."
if [ -f "server/package.json" ]; then
    if ! (cd server && npm install); then
        echo "  ERROR: Server npm install failed."
        exit 1
    fi
    echo "  Server dependencies installed."
fi
if [ "$INSTALL_DEPS" = true ]; then
    record_package_update
fi

echo "[7/13] Building frontend + server..."
if ! VITE_BASE="/$SERVICE/" npm run build:all; then
    echo "  ERROR: Build failed."
    echo "  Aborting. Check build output above."
    exit 1
fi
echo "  Build complete."

# 7b. Copy built files to parent dir for nginx root
echo "[7b/13] Deploying built files..."
cp -rf dist/* .
echo "  Built files deployed."

# 7c. Fix ownership and permissions
echo "[7c/13] Fixing ownership and permissions..."
echo "  Owner: $DEPLOY_USER:$DEPLOY_GROUP"
sudo chown -R "$DEPLOY_USER:$DEPLOY_GROUP" "$DIR"
find "$DIR" -type d -not -path "*/node_modules/*" -exec chmod 755 {} +
find "$DIR" -type f -not -path "*/node_modules/*" -exec chmod 644 {} +
# Restore execute bits on node_modules/.bin/* (chown -R can affect them)
find "$DIR/node_modules/.bin" -type f -exec chmod 755 {} + 2>/dev/null || true
chmod 600 "$DIR/server/.env" 2>/dev/null || true
chmod 600 "$DIR/deploy/.env" 2>/dev/null || true

# exported_data/ and tmp/ — group-writable so server process can write
chmod 775 "$DIR/exported_data" 2>/dev/null || true
chmod 775 "$DIR/exported_data/schedule_history" 2>/dev/null || true
find "$DIR/exported_data" -type f -exec chmod 664 {} + 2>/dev/null || true
sudo chgrp -R "$SHARED_GROUP" "$DIR/exported_data" 2>/dev/null || true

mkdir -p "$DIR/tmp"
chmod 775 "$DIR/tmp"
sudo chgrp "$SHARED_GROUP" "$DIR/tmp" 2>/dev/null || true
echo "  Done."

# 8. Fix systemd service file
echo "[8/13] Fixing systemd service file if needed..."
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
        sed "s|/var/www/html/hiker-app|$DIR|g; s|User=hiker|User=$DEPLOY_USER|g; s|Group=hiker|Group=$SHARED_GROUP|g" "$TEMPLATE" | sudo tee "$SERVICE_FILE" > /dev/null
        echo "  Created $SERVICE_FILE"
    else
        echo "  ERROR: Template $TEMPLATE not found"
        exit 1
    fi
fi
echo "  Reloading systemd daemon..."
sudo -n systemctl daemon-reload 2>&1 || echo "  WARNING: systemctl daemon-reload failed."

# 9. Generate nginx config (do NOT enable yet — cert may not exist)
echo "[9/13] Generating nginx config..."
NGINX_CONF="/etc/nginx/sites-available/$SERVICE"
NGINX_ENABLED="/etc/nginx/sites-enabled/$SERVICE"
SUBDOMAIN="$SERVICE"
TEMPLATE="$DEPLOY_DIR/hiker.conf.example"

# Remove existing symlink so nginx can pass tests without the cert
sudo rm -f "$NGINX_ENABLED"

if [ ! -f "$TEMPLATE" ]; then
    echo "  ERROR: Template $TEMPLATE not found."
    exit 1
fi

sed -e "s|<DOMAIN>|$DOMAIN|g" \
    -e "s|<PORT>|$SERVER_PORT|g" \
    -e "s|<SUBDOMAIN>|$SUBDOMAIN|g" \
    "$TEMPLATE" | sudo tee "$NGINX_CONF" > /dev/null
echo "  Config written to $NGINX_CONF (not enabled yet)."

# 10. Get/renew SSL certificate (--standalone, no nginx needed)
echo "[10/13] Getting SSL certificate for $DOMAIN..."
if command -v certbot &>/dev/null; then
    sudo systemctl stop nginx 2>/dev/null || true
    if ! sudo certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos --email "admin@example.com" --key-type ecdsa 2>&1; then
        echo "  WARNING: certbot failed (cert may already exist). Continuing..."
    else
        echo "  SSL certificate obtained/renewed."
    fi
else
    echo "  WARNING: certbot not installed — skipping SSL certificate setup"
fi

# 11. Enable site, test and restart nginx
echo "[11/13] Enabling site, testing and restarting nginx..."
sudo ln -s "$NGINX_CONF" "$NGINX_ENABLED"
if sudo nginx -t 2>&1 | grep -q "syntax is ok"; then
    sudo systemctl restart nginx
    echo "  Nginx restarted."
else
    echo "  ERROR: Nginx config test failed."
    exit 1
fi

# 12. Stop service and kill stale process on port
echo "[12/13] Stopping service and freeing port $SERVER_PORT..."
sudo -n systemctl stop "$SERVICE" 2>&1 || true
sleep 1
PORT_PID=$(sudo lsof -ti :$SERVER_PORT 2>/dev/null || true)
if [ -n "$PORT_PID" ]; then
    echo "  Found stale process on port $SERVER_PORT (PID: $PORT_PID) — killing."
    sudo kill -9 $PORT_PID 2>/dev/null || true
    sleep 1
fi
sudo systemctl daemon-reload 2>&1 || true

# 13. Start service
echo "[13/13] Starting service: $SERVICE"
if ! sudo -n systemctl start "$SERVICE" 2>&1; then
    echo "  ERROR: systemctl start failed."
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
