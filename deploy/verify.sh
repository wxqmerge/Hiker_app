#!/bin/bash

# Verify the Hiker site deployment
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

SERVICE="${SERVICE_NAME:-$(basename "$PWD")}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/html/$SERVICE}"

ERRORS=0
WARNINGS=0
DIR="$(pwd)"
DOMAIN="$(basename "$DIR").example.com"
if [ -f "$DIR/server/.env" ] && grep -q '^PORT=' "$DIR/server/.env"; then
    SERVER_PORT=$(grep '^PORT=' "$DIR/server/.env" | head -1 | cut -d= -f2- | tr -d '[:space:]')
else
    SERVER_PORT=3000
fi
NGINX_CONF="/etc/nginx/sites-available/$SERVICE"
NGINX_ENABLED="/etc/nginx/sites-enabled/$SERVICE"

# Track which categories have errors for targeted quick fixes
NEED_DEPS=false
NEED_BUILD=false
NEED_SERVER_BUILD=false
NEED_ENV=false
NEED_NGINX_CONF=false
NEED_NGINX_ENABLE=false
NEED_NGINX_RELOAD=false
NEED_SERVICE_START=false

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
    NEED_DEPS=true
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
        NEED_BUILD=true
    fi
else
    fail "dist/ missing — run npm run build"
    NEED_BUILD=true
fi

# 4. Server
echo ""
echo "--- Server ---"
if [ -d "server/dist" ]; then
    pass "server/dist/ exists"
    if [ -f "server/dist/index.js" ]; then
        pass "server/dist/index.js exists"
    else
        fail "server/dist/index.js missing"
        NEED_SERVER_BUILD=true
    fi
else
    fail "server/dist/ missing — run npm run build:server"
    NEED_SERVER_BUILD=true
fi

if [ -f "server/.env" ]; then
    pass "server/.env exists"
    if grep -q '^ADMIN_API_KEY=' server/.env; then
        ADMIN_KEY=$(grep '^ADMIN_API_KEY=' server/.env | head -1 | cut -d= -f2- | tr -d '[:space:]')
        if [ -n "$ADMIN_KEY" ]; then
            pass "ADMIN_API_KEY is set"
        else
            fail "ADMIN_API_KEY is empty"
            NEED_ENV=true
        fi
    else
        fail "ADMIN_API_KEY not found in server/.env"
        NEED_ENV=true
    fi
else
    fail "server/.env missing — copy server/.env.example to server/.env"
    NEED_ENV=true
fi

# 5. Nginx config
echo ""
echo "--- Nginx ---"
   if [ -f "$NGINX_CONF" ]; then
        pass "Nginx config exists at $NGINX_CONF"

        # Check for conflicting server names
        CONFLICT_COUNT=$(grep -rl "server_name $DOMAIN" /etc/nginx/sites-enabled/ 2>/dev/null | wc -l)
        if [ "$CONFLICT_COUNT" -gt 1 ]; then
            fail "Conflicting nginx configs found ($CONFLICT_COUNT files with server_name $DOMAIN)"
            echo "  Files:"
            grep -rl "server_name $DOMAIN" /etc/nginx/sites-enabled/ 2>/dev/null | while read -r f; do echo "    - $f"; done
            NEED_NGINX_RELOAD=true
        fi

        if grep -q "proxy_pass.*localhost:$SERVER_PORT" "$NGINX_CONF"; then
        pass "Proxy to Express configured (port $SERVER_PORT)"
    else
        warn "Proxy to Express not configured — all requests will fail"
    fi
    if grep -q "server_name $DOMAIN" "$NGINX_CONF"; then
        pass "server_name matches $DOMAIN"
    else
        warn "server_name mismatch — expected $DOMAIN"
        NEED_NGINX_RELOAD=true
        if [ "$FIX" = true ]; then
            echo "  Fix: sudo sed -i \"s/server_name .*/server_name $DOMAIN;/\" $NGINX_CONF"
        fi
    fi
else
    fail "Nginx config missing at $NGINX_CONF"
    NEED_NGINX_CONF=true
    NEED_NGINX_ENABLE=true
    if [ "$FIX" = true ]; then
        echo "  Fix: sudo cp deploy/hiker.conf $NGINX_CONF"
        echo "  Fix: sudo sed -i \"s/server_name .*/server_name $DOMAIN;/\" $NGINX_CONF"
    fi
fi

if [ -f "$NGINX_ENABLED" ]; then
    pass "Nginx site enabled"
else
    fail "Nginx site not enabled"
    NEED_NGINX_ENABLE=true
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

# 6. Service
echo ""
echo "--- Service ---"
if command -v systemctl &>/dev/null; then
    if sudo systemctl is-active --quiet "$SERVICE" 2>/dev/null; then
        pass "$SERVICE service is running"
    else
        fail "$SERVICE service is not running"
        NEED_SERVICE_START=true
        if [ "$FIX" = true ]; then
            echo "  Fix: sudo systemctl start $SERVICE"
        fi
    fi
else
    warn "systemctl not available (non-Linux?)"
fi

# 7. SSL certificate
echo ""
echo "--- SSL ---"
if command -v certbot &>/dev/null; then
    CERT_LIST=$(sudo certbot certificates 2>/dev/null || true)
    if echo "$CERT_LIST" | grep -q "$DOMAIN"; then
        pass "SSL certificate exists for $DOMAIN"
        EXPIRY=$(echo "$CERT_LIST" | grep -A5 "$DOMAIN" | grep "expires" | head -1)
        if [ -n "$EXPIRY" ]; then
            echo "  $EXPIRY"
        fi
    else
        warn "No SSL certificate for $DOMAIN — run certbot --nginx -d $DOMAIN"
    fi
else
    warn "certbot not installed"
fi

# 8. HTTPS checks
echo ""
echo "--- HTTPS Check ---"
if command -v curl &>/dev/null; then
    HTTPS_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "https://$DOMAIN/" 2>/dev/null || echo "000")
    if [ "$HTTPS_CODE" = "200" ]; then
        pass "HTTPS 200 from $DOMAIN (frontend)"
    else
        fail "HTTPS $HTTPS_CODE from $DOMAIN (frontend)"
    fi

    HEALTH_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "https://$DOMAIN/health" 2>/dev/null || echo "000")
    if [ "$HEALTH_CODE" = "200" ]; then
        pass "HTTPS 200 from /health (server)"
    else
        fail "HTTPS $HEALTH_CODE from /health (server)"
    fi

    HTTP_REDIRECT=$(curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN/" 2>/dev/null || echo "000")
    if [ "$HTTP_REDIRECT" = "301" ] || [ "$HTTP_REDIRECT" = "302" ]; then
        pass "HTTP redirects to HTTPS"
    elif [ "$HTTP_REDIRECT" = "200" ]; then
        warn "HTTP serves content directly (no HTTPS redirect)"
    else
        warn "HTTP returned $HTTP_REDIRECT"
    fi
else
    warn "curl not available — skipping HTTPS check"
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

    # Diagnostic info when there are errors
    echo "--- Diagnostics ---"
    echo ""
    echo "Service status:"
    sudo systemctl is-active "$SERVICE" 2>/dev/null && echo "  Running" || echo "  NOT running"
    echo ""
    echo "Nginx status:"
    sudo systemctl is-active nginx 2>/dev/null && echo "  Running" || echo "  NOT running"
    echo ""
    echo "Nginx config test:"
    sudo nginx -t 2>&1
    echo ""
    echo "Nginx sites-enabled:"
    ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "  No sites-enabled directory"
    echo ""
    echo "Nginx proxy_pass:"
    grep -n "proxy_pass" "$NGINX_CONF" 2>/dev/null || echo "  No proxy_pass found"
    echo ""
    echo "Conflicting server names:"
    grep -rl "server_name $DOMAIN" /etc/nginx/sites-enabled/ 2>/dev/null | wc -l | xargs -I{} echo "  {} file(s) found"
    grep -rl "server_name $DOMAIN" /etc/nginx/sites-enabled/ 2>/dev/null | while read -r f; do echo "    - $f"; done
    echo ""
    echo "Local HTTPS test:"
    LOCAL_HTTPS=$(curl -sk -o /dev/null -w "%{http_code}" https://localhost/ 2>/dev/null || echo "000")
    echo "  HTTP $LOCAL_HTTPS"
    echo ""
    echo "Direct server health (port $SERVER_PORT):"
    DIRECT_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$SERVER_PORT/health" 2>/dev/null || echo "000")
    echo "  HTTP $DIRECT_HEALTH"
    echo ""
    echo "Quick fixes:"
    if [ "$NEED_DEPS" = true ]; then
        echo "  npm install && (cd server && npm install)"
    fi
    if [ "$NEED_BUILD" = true ] || [ "$NEED_SERVER_BUILD" = true ]; then
        echo "  npm run build:all"
    fi
    if [ "$NEED_ENV" = true ]; then
        echo "  cp server/.env.example server/.env && nano server/.env"
    fi
    if [ "$NEED_NGINX_CONF" = true ]; then
        echo "  sudo cp deploy/hiker.conf $NGINX_CONF"
        echo "  sudo sed -i \"s/server_name .*/server_name $DOMAIN;/\" $NGINX_CONF"
    fi
    if [ "$NEED_NGINX_ENABLE" = true ]; then
        echo "  sudo ln -s $NGINX_CONF $NGINX_ENABLED"
    fi
    if [ "$NEED_NGINX_RELOAD" = true ]; then
        echo "  sudo nginx -t && sudo systemctl reload nginx"
    fi
    if [ "$NEED_SERVICE_START" = true ]; then
        echo "  sudo systemctl restart $SERVICE"
    fi
    if [ "$DIRECT_HEALTH" != "200" ]; then
        echo "  sudo systemctl restart $SERVICE"
    fi
fi

exit $ERRORS
