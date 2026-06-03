#!/bin/bash

# Verify the hiker site deployment
# Usage: ./verify.sh [--fix]

FIX=false
for arg in "$@"; do
    case $arg in
        --fix) FIX=true ;;
    esac
done

# Load local deployment config
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$DEPLOY_DIR/.env" ]; then
    source "$DEPLOY_DIR/.env"
fi

SERVICE="${SERVICE_NAME:-hiker}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/html/$SERVICE}"

ERRORS=0
WARNINGS=0
DIR="$(pwd)"
NGINX_CONF="/etc/nginx/sites-available/$SERVICE"
NGINX_ENABLED="/etc/nginx/sites-enabled/$SERVICE"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "${YELLOW}⚠${NC} $1"; WARNINGS=$((WARNINGS + 1)); }

echo "=== Verifying $DIR ==="
echo ""

# 1. Git
echo "--- Git ---"
if git diff --quiet 2>/dev/null; then
    pass "No uncommitted changes"
else
    warn "Uncommitted changes detected"
fi

HEAD=$(git log --oneline -1 2>/dev/null || echo "unknown")
echo "  HEAD: $HEAD"

# 2. Node dependencies
echo ""
echo "--- Node ---"
if [ -d "node_modules" ]; then
    pass "node_modules exists"
else
    fail "node_modules missing — run npm install"
fi

if [ -f "package.json" ]; then
    pass "package.json exists"
else
    fail "package.json missing"
fi

# 3. Build output
echo ""
echo "--- Build ---"
if [ -d "dist" ]; then
    pass "dist/ exists"
    DIST_FILES=$(find dist/ -type f | wc -l)
    echo "  Files: $DIST_FILES"
    if [ -f "dist/index.html" ]; then
        pass "dist/index.html exists"
    else
        fail "dist/index.html missing"
    fi
else
    fail "dist/ missing — run npm run build"
fi

# 4. Nginx config
echo ""
echo "--- Nginx ---"
if [ -f "$NGINX_CONF" ]; then
    pass "Nginx config exists at $NGINX_CONF"
    if grep -q "$DEPLOY_PATH/dist" "$NGINX_CONF"; then
        pass "Nginx root points to correct path"
    else
        warn "Nginx root may not point to $DEPLOY_PATH/dist"
    fi
else
    fail "Nginx config missing at $NGINX_CONF"
    if [ "$FIX" = true ]; then
        echo "  Fix: sudo cp deploy/hiker.conf $NGINX_CONF"
        echo "  Fix: sudo sed -i 's|DEPLOY_PLACEHOLDER|$(basename $DEPLOY_PATH)|g' $NGINX_CONF"
    fi
fi

if [ -f "$NGINX_ENABLED" ]; then
    pass "Nginx site enabled"
else
    fail "Nginx site not enabled"
    if [ "$FIX" = true ]; then
        echo "  Fix: sudo ln -s $NGINX_CONF $NGINX_ENABLED"
    fi
fi

if command -v nginx &>/dev/null; then
    if sudo nginx -t 2>&1 | grep -q "syntax is ok"; then
        pass "Nginx config test passed"
    else
        fail "Nginx config test failed"
        sudo nginx -t 2>&1 | head -5
    fi
else
    warn "nginx not installed"
fi

# 5. Nginx running
echo ""
echo "--- Nginx Service ---"
if command -v systemctl &>/dev/null; then
    if sudo systemctl is-active --quiet nginx 2>/dev/null; then
        pass "Nginx is running"
    else
        fail "Nginx is not running"
        if [ "$FIX" = true ]; then
            echo "  Fix: sudo systemctl start nginx"
        fi
    fi
else
    warn "systemctl not available (non-Linux?)"
fi

# 6. HTTP check
echo ""
echo "--- HTTP Check ---"
if command -v curl &>/dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        pass "HTTP 200 from localhost"
    else
        fail "HTTP $HTTP_CODE from localhost"
    fi
else
    warn "curl not available — skipping HTTP check"
fi

# Summary
echo ""
echo "=== Summary ==="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}All checks passed.${NC}"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}No errors, $WARNINGS warning(s).${NC}"
else
    echo -e "${RED}$ERRORS error(s), $WARNINGS warning(s).${NC}"
    echo ""
    echo "Quick fixes:"
    echo "  npm install && npm run build"
    echo "  sudo cp deploy/hiker.conf $NGINX_CONF"
    echo "  sudo sed -i 's|DEPLOY_PLACEHOLDER|$(basename $DEPLOY_PATH)|g' $NGINX_CONF"
    echo "  sudo ln -s $NGINX_CONF $NGINX_ENABLED"
    echo "  sudo nginx -t && sudo systemctl reload nginx"
fi

exit $ERRORS
