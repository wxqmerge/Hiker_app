#!/bin/bash

# Update and deploy the hiker static site
# Usage: ./update.sh [--force]

set -e

# Parse flags
FORCE=false
for arg in "$@"; do
    case $arg in
        --force) FORCE=true ;;
    esac
done

SERVICE="hiker"
DIR="$(pwd)"
NGINX_HTML="/var/www/hiker"

echo "=== Deploying $SERVICE ==="
echo "Directory: $DIR"
echo ""

# 1. Stash local changes
echo "[1/5] Stashing local changes..."
if ! git diff --quiet 2>/dev/null; then
    if git stash; then
        echo "  Changes stashed."
    else
        echo "  ERROR: Failed to stash. Aborting."
        exit 1
    fi
else
    echo "  No local changes."
fi

# 2. Pull latest
echo "[2/5] Pulling latest code..."
if ! git pull --rebase 2>/dev/null; then
    if git fetch origin main && git reset --hard origin/main; then
        echo "  Reset to origin/main."
    else
        echo "  ERROR: Failed to update. Restoring stash..."
        git stash pop 2>/dev/null || true
        exit 1
    fi
fi
echo "  Pulled successfully."

# 3. Install and build
echo "[3/5] Installing dependencies and building..."
if [ "$FORCE" = true ]; then
    rm -rf node_modules
fi
if ! npm install; then
    echo "  ERROR: npm install failed."
    exit 1
fi
if ! npm run build; then
    echo "  ERROR: Build failed."
    exit 1
fi
echo "  Build complete."

# 4. Deploy to nginx directory
echo "[4/5] Deploying to $NGINX_HTML..."
mkdir -p "$NGINX_HTML"
rm -rf "${NGINX_HTML:?}/"*
cp -r dist/* "$NGINX_HTML/"
echo "  Files copied."

# 5. Reload nginx
echo "[5/5] Reloading nginx..."
if sudo nginx -t 2>&1 && sudo systemctl reload nginx; then
    echo "  Nginx reloaded."
else
    echo "  WARNING: Nginx reload failed."
fi

echo ""
echo "=== Deploy complete. ==="
