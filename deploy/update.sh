#!/bin/bash

# Update and deploy the hiker static site
# Usage: ./update.sh [service-name]

# Don't exit on error - keep SSH session alive
# We handle errors manually below

SERVICE="${1:-hiker}"
DIR="$(pwd)"
NGINX_HTML="/var/www/hiker"

echo "=== Deploying $SERVICE ==="
echo "Directory: $DIR"
echo "Service:   $SERVICE"
echo ""
echo "To trace live logs: journalctl -u $SERVICE -f"
echo ""

# 1. Stash any local changes
echo "[1/5] Stashing local changes..."
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

# 2. Pull latest code (or reset to remote if branches diverged)
echo "[2/5] Pulling latest code..."
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

# 3. Clean stale build artifacts
echo "[3/5] Cleaning stale build artifacts..."
if [ -d "dist" ]; then
    rm -rf dist
    echo "  Removed dist/"
fi
if [ -d "node_modules" ]; then
    rm -rf node_modules
    echo "  Removed node_modules/"
fi

# 4. Install dependencies and build
echo "[4/5] Installing dependencies and building..."
if ! npm install; then
    echo "  ERROR: npm install failed."
    exit 1
fi
if ! npm run build; then
    echo "  ERROR: Build failed."
    echo "  Aborting. Check build output above."
    exit 1
fi
echo "  Build complete."

# 5. Deploy to nginx directory and reload
echo "[5/5] Deploying to $NGINX_HTML..."
mkdir -p "$NGINX_HTML"
rm -rf "${NGINX_HTML:?}/"*
cp -r dist/* "$NGINX_HTML/"
echo "  Files copied."

if sudo nginx -t 2>&1 && sudo systemctl reload nginx; then
    echo "  Nginx reloaded."
else
    echo "  WARNING: Nginx reload failed."
fi

echo ""
echo "=== Deploy complete. $SERVICE is deployed. ==="
echo ""
echo "To trace live logs: journalctl -u $SERVICE -f"
