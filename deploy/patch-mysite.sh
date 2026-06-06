#!/bin/bash

# Patch mysite.conf to serve hiker frontend
# Run on the server: bash deploy/patch-mysite.sh

MYCONF="${DEPLOY_MYCONF:-/etc/nginx/sites-available/mysite.conf}"
HIKER_ROOT="${DEPLOY_ROOT}"
SUBDOMAIN="${DEPLOY_SUBDOMAIN}"

if [ -z "$HIKER_ROOT" ] || [ -z "$SUBDOMAIN" ]; then
    echo "ERROR: DEPLOY_ROOT and DEPLOY_SUBDOMAIN must be set"
    exit 1
fi

if [ ! -f "$MYCONF" ]; then
    echo "ERROR: $MYCONF not found"
    exit 1
fi

# Check if already patched
if grep -q "$SUBDOMAIN" "$MYCONF"; then
    echo "Already patched. Skipping."
    exit 0
fi

# Add location block before the closing brace of the HTTPS server block
sudo sed -i "/^    listen 443 ssl;/i\\
    # Hiker app - serve frontend from /$SUBDOMAIN/\\
    location /$SUBDOMAIN/ {\\
        alias '"$HIKER_ROOT"'/dist/;\\
        try_files \$uri \$uri/ /index.html;\\
    }\\
" "$MYCONF"

sudo nginx -t 2>&1 && sudo systemctl reload nginx
echo "Patched $MYCONF with /$SUBDOMAIN/ location block"
