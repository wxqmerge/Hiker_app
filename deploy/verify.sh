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

if [ -f "$NGINX_CONF" ]; then
    NGINX_PORT=$(grep "proxy_pass" "$NGINX_CONF" | grep -oE '[0-9]+' | tail -1)
    if [ -n "$NGINX_PORT" ] && [ "$NGINX_PORT" != "$SERVER_PORT" ]; then
        warn "Port mismatch: .env uses $SERVER_PORT, but Nginx proxies to $NGINX_PORT"
        SERVER_PORT=$NGINX_PORT
    fi
fi

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

# 3. Python dependencies (needed for .xls import)
echo ""
echo "--- Python ---"
PYTHON_CMD=""
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
fi

if [ -n "$PYTHON_CMD" ]; then
    pass "Python found ($PYTHON_CMD)"
    $PYTHON_CMD -c "import pandas" 2>/dev/null
    if [ $? -eq 0 ]; then
        pass "pandas is installed"
    else
        fail "pandas not installed — .xls import will fail"
        echo "  Fix: sudo apt install python3-pandas python3-openpyxl"
    fi
    $PYTHON_CMD -c "import xlrd" 2>/dev/null
    if [ $? -eq 0 ]; then
        pass "xlrd is installed"
    else
        fail "xlrd not installed — binary .xls import will fail"
        echo "  Fix: sudo apt install python3-xlrd"
    fi
    $PYTHON_CMD -c "import openpyxl" 2>/dev/null
    if [ $? -eq 0 ]; then
        pass "openpyxl is installed"
    else
        warn "openpyxl not installed — .xlsx import will fail"
        echo "  Fix: sudo apt install python3-openpyxl"
    fi
else
    fail "Python not found — .xls import will fail"
    echo "  Fix: sudo apt install python3 python3-pandas python3-xlrd python3-openpyxl"
fi

# 4. Build output
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

# 5. Server
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

# Check if server is actually responding locally
if command -v curl &>/dev/null; then
    if curl -sk --max-time 2 "http://localhost:$SERVER_PORT/health" >/dev/null 2>&1; then
        pass "Server responding on localhost:$SERVER_PORT"
    else
        warn "Server process might be running but not responding on localhost:$SERVER_PORT"
    fi
fi

# 6. Nginx config
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

    if grep -qE "proxy_pass.*(localhost|127\.0\.0\.1):$SERVER_PORT" "$NGINX_CONF"; then
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

    # Check SPA location block uses root, not alias (alias breaks try_files fallback)
    SPA_PATH=$(grep -oE 'location [^ ]+/' "$NGINX_CONF" | grep -v '/api/' | grep -v '/health' | grep -v '/\.' | head -1 | awk '{print $2}')
    if [ -n "$SPA_PATH" ]; then
        SPA_BLOCK=$(sed -n "/location ${SPA_PATH}/,/}/p" "$NGINX_CONF")
        if echo "$SPA_BLOCK" | grep -q '^\s*alias'; then
            fail "SPA location $SPA_PATH uses 'alias' — breaks SPA refresh (use 'root' instead)"
            NEED_NGINX_RELOAD=true
            if [ "$FIX" = true ]; then
                ROOT_DIR=$(echo "$SPA_BLOCK" | grep 'alias' | awk '{print $2}' | tr -d ';')
                ROOT_DIR=$(dirname "$ROOT_DIR")
                echo "  Fix: sudo sed -i 's|alias ${ROOT_DIR}/;|root ${ROOT_DIR};|' $NGINX_CONF"
                echo "  Fix: sudo nginx -t && sudo systemctl reload nginx"
            fi
        else
            pass "SPA location $SPA_PATH uses 'root' (correct for SPA)"
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

# 7. Service
echo ""
echo "--- Service ---"
if command -v systemctl &>/dev/null; then
    SERVICE_STATE=$(systemctl show -p ActiveState --value "$SERVICE" 2>/dev/null || echo "unknown")
    if systemctl is-active --quiet "$SERVICE"; then
        pass "$SERVICE service is running"
    elif systemctl show -p ActiveState --value "$SERVICE" | grep -q "activating"; then
        warn "$SERVICE service is activating (it may take a moment to respond)"
    else
        fail "$SERVICE service is not running ($(systemctl show -p ActiveState --value "$SERVICE" || echo "unknown"))"
        NEED_SERVICE_START=true
        if [ "$FIX" = true ]; then
            echo "  Fix: sudo systemctl start $SERVICE"
        fi
    fi
else
    warn "systemctl not available (non-Linux?)"
fi

# 8. Disk Space
echo ""
echo "--- Disk Space ---"
DISK_USAGE=$(df / --output=pcent | tail -1 | tr -dc '0-9')
if [ "$DISK_USAGE" -gt 90 ]; then
    fail "Disk space is critically low ($DISK_USAGE% used)"
else
    pass "Disk space is healthy ($DISK_USAGE% used)"
fi

# 9. SSL certificate
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

# 10. HTTPS checks
echo ""
echo "--- HTTPS Check ---"
if command -v curl &>/dev/null; then
    # Use FRONTEND_URL if set, otherwise default to the domain root or subpath
    if [ -z "$FRONTEND_URL" ]; then
        if [[ "$DOMAIN" == *".example.com" ]]; then
            SUBDOMAIN=$(echo "$DOMAIN" | cut -d'.' -f1)
            FRONTEND_URL="https://example.com/$SUBDOMAIN/"
        else
            FRONTEND_URL="https://$DOMAIN/"
        fi
    fi

    # --- Frontend Check ---
    HTTPS_CODE=$(curl -sk --max-time 5 -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null | tr -d '[:space:]')
    if [[ "$HTTPS_CODE" =~ ^0+$ || -z "$HTTPS_CODE" ]]; then
        SUBPATH=$(echo "$FRONTEND_URL" | sed -E 's|^https?://[^/]+||')
        LOCAL_FRONTEND_URL="http://localhost:$SERVER_PORT$SUBPATH"
        LOCAL_HTTPS_CODE=$(curl -sk --max-time 5 -o /dev/null -w "%{http_code}" "$LOCAL_FRONTEND_URL" 2>/dev/null | tr -d '[:space:]')
        if [[ "$LOCAL_HTTPS_CODE" =~ ^0+$ || -z "$LOCAL_HTTPS_CODE" ]]; then
            HTTPS_CODE="000"
        elif [ "$LOCAL_HTTPS_CODE" = "200" ]; then
            warn "Public $FRONTEND_URL unreachable (DNS/NAT?), but $LOCAL_FRONTEND_URL is OK"
            HTTPS_CODE="200"
        else
            HTTPS_CODE="$LOCAL_HTTPS_CODE"
        fi
    fi

    if [ "$HTTPS_CODE" = "200" ]; then
        pass "HTTPS 200 from $FRONTEND_URL (frontend)"
    else
        fail "HTTPS $HTTPS_CODE from $FRONTEND_URL (frontend)"
    fi

    # --- Server Health Check ---
    HEALTH_CODE=$(curl -sk --max-time 5 -o /dev/null -w "%{http_code}" "https://$DOMAIN/health" 2>/dev/null | tr -d '[:space:]')
    if [[ "$HEALTH_CODE" =~ ^0+$ || -z "$HEALTH_CODE" ]]; then
        HEALTH_CODE=$(curl -sk --max-time 5 -o /dev/null -w "%{http_code}" "http://localhost:$SERVER_PORT/health" 2>/dev/null | tr -d '[:space:]')
        if [[ "$HEALTH_CODE" =~ ^0+$ || -z "$HEALTH_CODE" ]]; then
            HEALTH_CODE="000"
        elif [ "$HEALTH_CODE" = "200" ]; then
            warn "HTTPS $DOMAIN/health unreachable (DNS?), but http://localhost:$SERVER_PORT/health is OK"
            HEALTH_CODE="200"
        fi
    fi

    if [ "$HEALTH_CODE" = "200" ]; then
        pass "HTTPS 200 from /health (server)"
    else
        fail "HTTPS $HEALTH_CODE from /health (server)"
    fi

    # --- Redirect Check ---
    HTTP_REDIRECT=$(curl -sk --max-time 5 -s -o /dev/null -w "%{http_code}" "http://$DOMAIN/" 2>/dev/null | tr -d '[:space:]')
    if [[ "$HTTP_REDIRECT" =~ ^0+$ || -z "$HTTP_REDIRECT" ]]; then
        LOCAL_REDIRECT_URL="http://localhost:$SERVER_PORT/"
        HTTP_REDIRECT=$(curl -sk --max-time 5 -s -o /dev/null -w "%{http_code}" "$LOCAL_REDIRECT_URL" 2>/dev/null | tr -d '[:space:]')
        if [[ "$HTTP_REDIRECT" =~ ^0+$ || -z "$HTTP_REDIRECT" ]]; then
            HTTP_REDIRECT="000"
        fi
    fi

    if [ "$HTTP_REDIRECT" = "301" ] || [ "$HTTP_REDIRECT" = "302" ]; then
        pass "HTTP redirects to HTTPS"
    elif [ "$HTTP_REDIRECT" = "200" ]; then
        warn "HTTP serves content directly (no HTTPS redirect)"
    elif [ "$HTTP_REDIRECT" = "000" ]; then
        warn "HTTP returned 000 (unreachable)"
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
    if sudo systemctl is-active "$SERVICE" 2>/dev/null; then
        echo "  Running"
    else
        echo "  NOT running"
        NEED_SERVICE_START=true
    fi
    echo ""
    echo "Nginx status:"
    if sudo systemctl is-active nginx 2>/dev/null; then
        echo "  Running"
    else
        echo "  NOT running"
        NEED_NGINX_RELOAD=true
    fi
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
    echo "Local server health test:"
    LOCAL_HEALTH=$(curl -sk --max-time 5 -o /dev/null -w "%{http_code}" "http://localhost:$SERVER_PORT/health" 2>/dev/null | tr -d '[:space:]' || echo "000")
    echo "  HTTP $LOCAL_HEALTH"
    echo ""
    echo "Direct server health (port $SERVER_PORT):"
    DIRECT_HEALTH=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" "http://localhost:$SERVER_PORT/health" 2>/dev/null | tr -d '[:space:]' || echo "000")
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
    CONFLICT_COUNT=$(grep -rl "server_name $DOMAIN" /etc/nginx/sites-enabled/ 2>/dev/null | wc -l)
    if [ "$CONFLICT_COUNT" -gt 1 ]; then
        echo "  Remove conflicting configs:"
        grep -rl "server_name $DOMAIN" /etc/nginx/sites-enabled/ 2>/dev/null | while read -r f; do echo "    sudo rm $f"; done
        echo "  sudo systemctl reload nginx"
    fi
    if [ "$NEED_SERVICE_START" = true ]; then
        echo "  sudo systemctl enable --now $SERVICE"
    fi
    if [ "$DIRECT_HEALTH" != "200" ]; then
        echo "  sudo systemctl restart $SERVICE"
    fi
fi

exit $ERRORS
