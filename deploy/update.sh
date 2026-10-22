#!/bin/bash

# Update and restart the Hiker server
# Usage: ./update.sh [service-name] [--force|--force-critical]
#   --force          Bypass all cooldowns and force package update
#   --force-critical Force package update for critical security patches (2-day cooldown)

# npm must run as the deploy user. Running the whole script through sudo uses
# root's npm cache, changes repository ownership, and can make step 6 appear to hang.
if [ "$(id -u)" -eq 0 ]; then
    echo "ERROR: Do not run update.sh as root or with sudo."
    echo "Run it as the Hiker deploy user; privileged commands already use sudo."
    exit 1
fi

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
APP_NAME="${SERVICE//_/-}"
DIR="$(pwd)"
DEPLOY_USER="$(whoami)"
SHARED_GROUP="www-data"
source "$DEPLOY_DIR/hiker-env.sh"
ENV_FILE="$DIR/server/.env"
SECRET_FILE="$(hiker_secret_file_for "$SERVICE")"

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

NPM_INSTALL_TIMEOUT="${NPM_INSTALL_TIMEOUT:-900}"
NPM_INSTALL_FLAGS=(
    --no-audit
    --no-fund
    --no-progress
    --prefer-offline
    --fetch-timeout=120000
    --fetch-retries=1
    --fetch-retry-mintimeout=2000
    --fetch-retry-maxtimeout=15000
)

install_npm_dependencies() {
    local install_dir="$1"
    local npm_command

    if [ ! -f "$install_dir/package-lock.json" ]; then
        npm_command="install"
    elif [ ! -d "$install_dir/node_modules" ] || [ ! -f "$install_dir/node_modules/.package-lock.json" ]; then
        npm_command="ci"
    else
        npm_command="install"
    fi

    run_npm() {
        local command="$1"
        (
            cd "$install_dir" || exit 1
            if command -v timeout >/dev/null 2>&1; then
                timeout --foreground --kill-after=30 "$NPM_INSTALL_TIMEOUT" npm "$command" "${NPM_INSTALL_FLAGS[@]}"
            else
                npm "$command" "${NPM_INSTALL_FLAGS[@]}"
            fi
        )
    }

    echo "  npm $npm_command (timeout: ${NPM_INSTALL_TIMEOUT}s)"

    if run_npm "$npm_command"; then
        return 0
    fi

    if [ "$npm_command" = "install" ] && [ -f "$install_dir/package-lock.json" ]; then
        echo "  npm install failed or timed out — retrying with npm ci"
        run_npm ci
        return $?
    fi

    return 1
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
if [ ! -f "$ENV_FILE" ]; then
    echo "  ERROR: $ENV_FILE not found."
    echo "  API key (ADMIN_API_KEY) is required for production."
    echo "  Copy server/.env.example to server/.env and set your key."
    exit 1
fi

if hiker_has_env_value ADMIN_API_KEY "$SECRET_FILE"; then
    echo "  ADMIN_API_KEY: (set)"
    echo "  Key source:    $SECRET_FILE"
elif hiker_has_env_value ADMIN_API_KEY "$ENV_FILE"; then
    echo "  ADMIN_API_KEY: (set)"
    echo "  WARNING: legacy key location: $ENV_FILE"
    echo "  Consider running: sudo bash ./deploy/secure-env.sh"
else
    echo "  ERROR: ADMIN_API_KEY is missing or unreadable."
    echo "  Deploy aborted. Set the key and try again."
    exit 1
fi

if grep -q '^DOMAIN=' "$ENV_FILE"; then
    DOMAIN=$(grep '^DOMAIN=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '[:space:]')
else
    DOMAIN="example.com"
fi
FULL_DOMAIN="$(basename "$DIR").$DOMAIN"
echo "  DOMAIN: $FULL_DOMAIN"

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
        if ! install_npm_dependencies "$DIR"; then
            echo "  ERROR: Frontend npm install failed or timed out."
            exit 1
        fi
        echo "  Dependencies installed."
    fi
fi

echo "[6/13] Installing server dependencies..."
if [ -f "server/package.json" ]; then
    if ! install_npm_dependencies "$DIR/server"; then
        echo "  ERROR: Server npm install failed or timed out."
        echo "  Retry with visible npm output:"
        echo "    cd $DIR/server && npm ci --no-audit --no-fund --loglevel=http"
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
echo "  Owner: $DEPLOY_USER:$SHARED_GROUP"
sudo chown -R "$DEPLOY_USER:$SHARED_GROUP" "$DIR"
# Keep the repo group-only by default. Nginx should serve only static output; do
# not make .git, server, deploy, source, and data directories world-readable.
find "$DIR" -type d -not -path "*/node_modules/*" -exec chmod 750 {} + 2>/dev/null || true
find "$DIR" -type f -not -path "*/node_modules/*" -exec chmod 640 {} + 2>/dev/null || true
chmod 755 "$DIR"
for entry in "$DIR"/*; do
    [ -e "$entry" ] || continue
    base="$(basename "$entry")"
    case "$base" in
        node_modules|server|deploy|src|scripts|shared|exported_data|tmp|coverage)
            continue
            ;;
    esac
    if [ -d "$entry" ]; then
        find "$entry" -type d -exec chmod 755 {} + 2>/dev/null || true
        find "$entry" -type f -exec chmod 644 {} + 2>/dev/null || true
    elif [ -f "$entry" ]; then
        chmod 644 "$entry" 2>/dev/null || true
    fi
done
find "$DIR/node_modules/.bin" -type f -exec chmod 755 {} + 2>/dev/null || true
find "$DIR" -maxdepth 1 -name '.env*' -exec chmod 600 {} + 2>/dev/null || true
chmod 600 "$DIR/server/.env" 2>/dev/null || true
chmod 600 "$DIR/deploy/.env" 2>/dev/null || true
find "$DEPLOY_DIR" -maxdepth 1 -type f -name '*.sh' -exec chmod 750 {} + 2>/dev/null || true
if [ -d "$DIR/scripts" ]; then
    find "$DIR/scripts" -maxdepth 1 -type f -name '*.sh' -exec chmod 750 {} + 2>/dev/null || true
fi
if [ -d "$DIR/.git" ]; then
    chmod -R go-rwx "$DIR/.git" 2>/dev/null || true
fi
if [ -f "$SECRET_FILE" ]; then
    hiker_run_as_root chmod 640 "$SECRET_FILE" 2>/dev/null || true
fi

# exported_data/ and tmp/ — group-writable so server process can write
chmod 775 "$DIR/exported_data" 2>/dev/null || true
chmod 775 "$DIR/exported_data/schedule_history" 2>/dev/null || true
mkdir -p "$DIR/exported_data/gpx"
chmod 775 "$DIR/exported_data/gpx"
find "$DIR/exported_data" -type f -exec chmod 664 {} + 2>/dev/null || true

mkdir -p "$DIR/tmp"
chmod 775 "$DIR/tmp"
echo "  Done."

# 8. Fix systemd service file
echo "[8/13] Fixing systemd service file if needed..."
SERVICE_FILE="/etc/systemd/system/$SERVICE.service"
if [ ! -f "$SERVICE_FILE" ]; then
    echo "  WARNING: $SERVICE_FILE not found — creating from template"
    TEMPLATE="$DEPLOY_DIR/hiker-app.service"
    if [ -f "$TEMPLATE" ]; then
        sed "s|/var/www/html/hiker-app|$DIR|g; s|<SECRET_FILE>|$SECRET_FILE|g; s|User=hiker|User=$DEPLOY_USER|g; s|Group=hiker|Group=$SHARED_GROUP|g" "$TEMPLATE" | sudo tee "$SERVICE_FILE" > /dev/null
        echo "  Created $SERVICE_FILE"
    else
        echo "  ERROR: Template $TEMPLATE not found"
        exit 1
    fi
fi

if [ -f "$SERVICE_FILE" ]; then
    SERVICE_SECTION=$(sed -n '/^\[Service\]/,/^\[/p' "$SERVICE_FILE")
    if ! echo "$SERVICE_SECTION" | grep -q '^EnvironmentFile='; then
        if grep -q '^EnvironmentFile=' "$SERVICE_FILE" 2>/dev/null; then
            echo "  WARNING: EnvironmentFile found outside [Service] — replacing it."
            hiker_run_as_root sed -i '/^EnvironmentFile=/d' "$SERVICE_FILE"
        fi
    fi

    if ! hiker_set_service_option "$SERVICE_FILE" User "$DEPLOY_USER"; then
        echo "  WARNING: Could not configure User=$DEPLOY_USER for $SERVICE_FILE"
    fi
    if ! hiker_set_service_option "$SERVICE_FILE" Group "$SHARED_GROUP"; then
        echo "  WARNING: Could not configure Group=$SHARED_GROUP for $SERVICE_FILE"
    fi

    if hiker_ensure_environment_file "$SERVICE_FILE" "$ENV_FILE"; then
        echo "  EnvironmentFile: $ENV_FILE"
    else
        echo "  WARNING: Could not configure EnvironmentFile for $ENV_FILE"
    fi

    if [ -f "$SECRET_FILE" ]; then
        if hiker_ensure_environment_file "$SERVICE_FILE" "$SECRET_FILE"; then
            echo "  ProtectedKeyFile: $SECRET_FILE"
        else
            echo "  WARNING: Could not configure EnvironmentFile for $SECRET_FILE"
        fi
    fi
fi

echo "  Reloading systemd daemon..."
sudo -n systemctl daemon-reload 2>&1 || echo "  WARNING: systemctl daemon-reload failed."

# 9. Generate nginx config (do NOT enable yet — cert may not exist)
echo "[9/13] Generating nginx config..."
NGINX_CONF="/etc/nginx/sites-available/$SERVICE"
NGINX_ENABLED="/etc/nginx/sites-enabled/$SERVICE"
TEMPLATE="$DEPLOY_DIR/hiker.conf.example"

# Remove existing symlink so nginx can pass tests without the cert
sudo rm -f "$NGINX_ENABLED"

if [ ! -f "$TEMPLATE" ]; then
    echo "  ERROR: Template $TEMPLATE not found."
    exit 1
fi

sed -e "s|<DOMAIN>|$FULL_DOMAIN|g" \
    -e "s|<PORT>|$SERVER_PORT|g" \
    -e "s|<APP_NAME>|$APP_NAME|g" \
    "$TEMPLATE" | sudo tee "$NGINX_CONF" > /dev/null
echo "  Config written to $NGINX_CONF (not enabled yet)."

# 10. Get/renew SSL certificate (--standalone, no nginx needed)
echo "[10/13] Getting SSL certificate for $FULL_DOMAIN..."
if command -v certbot &>/dev/null; then
    sudo systemctl stop nginx 2>/dev/null || true
    if ! sudo certbot certonly --standalone -d "$FULL_DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" --key-type ecdsa 2>&1; then
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
