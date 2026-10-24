#!/bin/bash

# Update and restart the Hiker server
# Usage: ./update.sh [service-name] [--force|--force-critical]
#   --force          Bypass all cooldowns and force package update
#   --force-critical Force package update for critical security patches (2-day cooldown)

# npm must run as the deploy user. Running the whole script through root uses
# root's npm cache, changes repository ownership, and can make step 6 hang.
SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

if [ "$(id -u)" -eq 0 ]; then
    chmod +x "$SCRIPT_PATH"
    if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
        echo "Re-running as $SUDO_USER..."
        exec sudo -u "$SUDO_USER" bash "$SCRIPT_PATH" "$@"
    fi

    echo "ERROR: Do not run update.sh as root."
    echo "Run it as the Hiker deploy user; privileged commands already use sudo."
    exit 1
fi

# Self-fix: restore execute permission if stripped by Windows
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
    # The installed unit can predate this script and still carry the template's
    # <SECRET_FILE> placeholder (deploy/hiker-app.service). systemd resolves that to
    # a path that does not exist, the leading '-' makes the miss non-fatal, and the
    # process starts with no key at all.
    if grep -qF '<SECRET_FILE>' "$SERVICE_FILE" 2>/dev/null; then
        hiker_run_as_root sed -i "s|<SECRET_FILE>|$SECRET_FILE|g" "$SERVICE_FILE" 2>/dev/null || true
        echo "  Replaced the <SECRET_FILE> placeholder with $SECRET_FILE"
    fi

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

        # The secret file is 640 root:$HIKER_SECRET_GROUP and /etc/hiker itself is
        # 750 root:$HIKER_SECRET_GROUP, so the account that RUNS the service must be
        # in that group. secure-env.sh adds the interactive admin user, never the
        # service user, and EnvironmentFile=- skips an unreadable file without any
        # error — which is how a green deploy ends up serving 403 on every admin route.
        SERVICE_USER_NOW=$(systemctl show -p User --value "$SERVICE" 2>/dev/null || echo "")
        [ -n "$SERVICE_USER_NOW" ] || SERVICE_USER_NOW="$DEPLOY_USER"
        if [ "$SERVICE_USER_NOW" != "root" ] && id "$SERVICE_USER_NOW" >/dev/null 2>&1 &&
           ! id -nG "$SERVICE_USER_NOW" 2>/dev/null | grep -qw "$HIKER_SECRET_GROUP"; then
            hiker_run_as_root groupadd -f "$HIKER_SECRET_GROUP" 2>/dev/null || true
            if hiker_run_as_root usermod -aG "$HIKER_SECRET_GROUP" "$SERVICE_USER_NOW" 2>/dev/null; then
                echo "  Added service user $SERVICE_USER_NOW to $HIKER_SECRET_GROUP"
            else
                echo "  WARNING: $SERVICE_USER_NOW cannot read $SECRET_FILE; add it manually:"
                echo "    sudo usermod -aG $HIKER_SECRET_GROUP $SERVICE_USER_NOW"
            fi
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
# Do NOT swallow this. With `|| true` a failed stop (passwordless sudo not granted,
# or a unit name that does not match) left the unit running with Restart=on-failure,
# and everything below then fights systemd for the port: kill the process and systemd
# starts another one within RestartSec, so the deploy loops on "still busy" while the
# thing it keeps killing is its own service. A missing unit is fine, anything else is
# a reason to stop here.
if ! STOP_OUT=$(sudo -n systemctl stop "$SERVICE" 2>&1); then
    case "$STOP_OUT" in
        *"could not be found"*|*"no such file"*|*"Not loaded"*|*"inactive"*)
            echo "  (no $SERVICE unit loaded yet — nothing to stop)"
            ;;
        *)
            echo "  ERROR: could not stop $SERVICE: $STOP_OUT"
            echo "  Aborting before touching the port: systemd's Restart= will re-spawn the"
            echo "  process faster than this script can kill it. Check with:"
            echo "    sudo systemctl status $SERVICE"
            echo "    sudo systemctl show $SERVICE -p MainPID -p NRestarts -p ExecMainStartTimestamp --value"
            exit 1
            ;;
    esac
fi
sleep 1
PORT_PID=$(hiker_port_owner_pid "$SERVER_PORT" || true)
if [ -n "$PORT_PID" ]; then
    PORT_CMD=$(ps -o cmd= -p "$PORT_PID" 2>/dev/null || echo "unknown")
    PORT_UNIT=$(hiker_process_unit "$PORT_PID" || true)
    echo "  Port $SERVER_PORT is still held by PID $PORT_PID after the stop:"
    echo "    user:    $(ps -o user= -p "$PORT_PID" 2>/dev/null | sed 's/^ *//')"
    echo "    started: $(ps -o lstart= -p "$PORT_PID" 2>/dev/null | sed 's/^ *//')"
    echo "    cmd:     $PORT_CMD"
    [ -n "$PORT_UNIT" ] && echo "    unit:    $PORT_UNIT"

    # If the holder belongs to THIS unit, the stop above did not take effect and killing
    # it is a losing fight: systemd re-spawns within RestartSec. Say so instead of
    # firing SIGKILL at our own service.
    if [ "$PORT_UNIT" = "$SERVICE.service" ]; then
        echo "  ERROR: that process is $SERVICE's OWN process — the stop did not take effect."
        echo "  Killing it is pointless while the unit is loaded: systemd starts another one"
        echo "  within RestartSec. Find out why stop failed:"
        echo "    sudo systemctl status $SERVICE"
        echo "    sudo systemctl show $SERVICE -p MainPID -p NRestarts -p ExecMainStartTimestamp -p Restart --value"
        exit 1
    fi

    # Kill it only if the process really belongs to THIS instance, decided from the
    # process's working directory rather than its cmdline text. If another instance
    # (sothh-dev, ramblers, travel…) owns the port, killing it takes down a different
    # site: that is a port-allocation bug in two server/.env files, not a process to
    # murder.
    if hiker_process_in_dir "$PORT_PID" "$DIR"; then
        echo "  cwd is inside $DIR — this instance's orphan. Killing it."
        hiker_run_as_root kill -9 "$PORT_PID" 2>/dev/null ||
            echo "  WARNING: kill -9 $PORT_PID did not succeed (permissions?)."
        for _ in 1 2 3 4 5; do
            hiker_port_owner_pid "$SERVER_PORT" >/dev/null 2>&1 || break
            sleep 1
        done

        STILL_PID=$(hiker_port_owner_pid "$SERVER_PORT" || true)
        if [ -n "$STILL_PID" ]; then
            echo "  ERROR: port $SERVER_PORT is still busy, now held by PID $STILL_PID."
            if [ "$STILL_PID" != "$PORT_PID" ]; then
                echo "  That is a DIFFERENT process, so this is a port fight between two"
                echo "  instances, not a stale process. Stop guessing and give this one its"
                echo "  own PORT in $ENV_FILE."
            else
                echo "  SIGKILL cannot be ignored, so either the kill was not permitted, the"
                echo "  PID is a zombie its parent will not reap, or a child of it inherited"
                echo "  the listening socket (a cluster/worker). Look:"
                echo "    sudo ps -o pid,ppid,stat,user,args -p $PORT_PID"
                echo "    pgrep -aP $PORT_PID"
                [ -n "$PORT_UNIT" ] && echo "    sudo systemctl stop $PORT_UNIT   # if it is a service, stop the UNIT"
            fi
            exit 1
        fi
        echo "  Port $SERVER_PORT freed."
    else
        echo "  ERROR: that process is not part of $DIR, so it is NOT being killed."
        [ -n "$PORT_UNIT" ] && echo "  It is owned by $PORT_UNIT."
        echo "  Two instances are configured with the same PORT. Give this one its own:"
        echo "    1) edit $ENV_FILE  (PORT=<free port>)"
        echo "    2) re-run this deploy so nginx proxy_pass follows the new port"
        echo "  Aborting before start — the service would die with EADDRINUSE."
        exit 1
    fi
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
if ! sudo systemctl is-active --quiet "$SERVICE"; then
    echo ""
    echo "=== WARNING: $SERVICE is NOT running! Check status: ==="
    echo "  sudo systemctl status $SERVICE"
    echo "  sudo journalctl -u $SERVICE --no-pager -n 20"
    # The usual reason a service that just built cleanly refuses to stay up is that
    # something else already owns its port: node dies with EADDRINUSE at listen(),
    # systemd restart-loops it every RestartSec, and the deploy log looks fine until
    # the journal is read. Name the squatter instead of leaving the user to find it.
    STALE_PID=$(hiker_port_owner_pid "$SERVER_PORT" || true)
    if [ -n "$STALE_PID" ]; then
        echo ""
        echo "  Port $SERVER_PORT is held by PID $STALE_PID — that is why it cannot bind:"
        ps -o pid,user,lstart,args -p "$STALE_PID" --no-headers 2>/dev/null | sed 's/^/    /'
        echo "  If it is a stale copy of $DIR:"
        echo "    sudo kill $STALE_PID && sudo systemctl reset-failed $SERVICE && sudo systemctl restart $SERVICE"
        echo "  If it is a DIFFERENT instance, do not kill it — one of the two needs its own PORT."
    fi
    exit 1
fi

# Active is not the same as usable. Step 3 read the key through sudo
# (hiker_read_env_value falls back to `sudo -n grep`), and EnvironmentFile=- skips
# a file the SERVICE user cannot read without a word of complaint — so the process
# can come up healthy, answer /health with 200, serve every public GET, and return
# 403 "ADMIN_API_KEY not configured" for every admin route. Nothing above can see
# that difference; the running process can, and needs no privileges to ask.
echo ""
echo "Probing the running process for the admin key..."
if hiker_probe_admin_key_loaded "http://localhost:$SERVER_PORT"; then
    echo "  ADMIN_API_KEY: loaded (/api/auth/verify $HIKER_ADMIN_PROBE_CODE)"
elif [ "$HIKER_ADMIN_PROBE_CODE" = "403" ]; then
    echo "  ERROR: the running $SERVICE process has NO admin key."
    echo "  /api/auth/verify answered 403 instead of 401, so the process started without"
    echo "  ADMIN_API_KEY even though this shell could read the key file."
    # A 403 can also mean the answer did not come from this unit at all: if some other
    # process owns the port, it is what answered, and it has its own (older) environment.
    ANSWERER_PID=$(hiker_port_owner_pid "$SERVER_PORT" || true)
    UNIT_PID=$(systemctl show -p MainPID --value "$SERVICE" 2>/dev/null || echo "")
    if [ -n "$ANSWERER_PID" ] && [ -n "$UNIT_PID" ] && [ "$ANSWERER_PID" != "$UNIT_PID" ]; then
        echo "  NOTE: port $SERVER_PORT is owned by PID $ANSWERER_PID, not by this unit's"
        echo "  MainPID $UNIT_PID — the 403 came from a process systemd does not control:"
        ps -o pid,user,lstart,args -p "$ANSWERER_PID" --no-headers 2>/dev/null | sed 's/^/    /'
        echo "    sudo kill $ANSWERER_PID && sudo systemctl reset-failed $SERVICE && sudo systemctl restart $SERVICE"
    fi
    echo "  Diagnose (a leading '-' on EnvironmentFile hides an unreadable file):"
    echo "    sudo systemctl cat $SERVICE | grep -E 'EnvironmentFile|^User=|^Group='"
    echo "    sudo ls -ld $HIKER_SECRET_DIR && sudo ls -l $SECRET_FILE"
    echo "    getent group $HIKER_SECRET_GROUP"
    echo "  Fix without changing the key:"
    echo "    sudo usermod -aG $HIKER_SECRET_GROUP \$(systemctl show -p User --value $SERVICE)"
    echo "    sudo systemctl daemon-reload && sudo systemctl restart $SERVICE"
    echo "  Then re-check (401 = fixed, 403 = still missing):"
    echo "    curl -s -w ' [%{http_code}]\n' http://localhost:$SERVER_PORT/api/auth/verify"
    echo ""
    echo "=== Update did NOT complete: $SERVICE is up, but admin routes are dead. ==="
    exit 1
else
    echo "  WARNING: could not probe /api/auth/verify (HTTP $HIKER_ADMIN_PROBE_CODE)."
    echo "  The admin key is NOT confirmed in the running process."
fi

echo ""
echo "=== Update complete. $SERVICE is running. ==="
echo ""
echo "To trace live logs: sudo journalctl -u $SERVICE -f"
