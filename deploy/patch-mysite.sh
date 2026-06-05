#!/bin/bash

# Patch mysite.conf to serve hiker frontend from /sothh-app/
# Run on the server: bash deploy/patch-mysite.sh

MYCONF="/etc/nginx/sites-available/mysite.conf"
HIKER_ROOT="/var/www/html/sothh-app"

if [ ! -f "$MYCONF" ]; then
    echo "ERROR: $MYCONF not found"
    exit 1
fi

# Check if already patched
if grep -q "sothh-app" "$MYCONF"; then
    echo "Already patched. Skipping."
    exit 0
fi

# Add location block before the closing brace of the HTTPS server block
sudo sed -i '/^    listen 443 ssl;/i\
    # Hiker app - serve frontend from /sothh-app/\
    location /sothh-app/ {\
        alias '"$HIKER_ROOT"'/dist/;\
        try_files $uri $uri/ /sothh-app/index.html;\
    }\
' "$MYCONF"

sudo nginx -t 2>&1 && sudo systemctl reload nginx
echo "Patched $MYCONF with /sothh-app/ location block"
