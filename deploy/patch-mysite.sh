#!/bin/bash

# Generate /etc/nginx/sites-available/mysite.conf
# Run on the server: bash deploy/patch-mysite.sh
#
# Auto-detects deployment directories under /var/www/html/
# and generates a single mysite.conf with location blocks for each.

SITES_DIR="/etc/nginx/sites-available"
SITES_ENABLED="/etc/nginx/sites-enabled"
HTML_BASE="/var/www/html"
MYCONF="$SITES_DIR/mysite.conf"

# Read DOMAIN from first available instance's server/.env
for dir in "$HTML_BASE"/*/; do
    [ -d "$dir" ] || continue
    if [ -f "$dir/server/.env" ] && grep -q '^DOMAIN=' "$dir/server/.env"; then
        DOMAIN=$(grep '^DOMAIN=' "$dir/server/.env" | head -1 | cut -d= -f2- | tr -d '[:space:]')
        break
    fi
done
DOMAIN="${DOMAIN:-example.com}"

# Collect deployment directories
DEPLOYMENTS=()
for dir in "$HTML_BASE"/*/; do
    [ -d "$dir" ] || continue
    subdir=$(basename "$dir")
    dist_dir="$dir/dist"
    [ -d "$dist_dir" ] || continue
    DEPLOYMENTS+=("$subdir:$dist_dir")
done

if [ ${#DEPLOYMENTS[@]} -eq 0 ]; then
    echo "No deployments found under $HTML_BASE"
    exit 1
fi

# Generate the config
cat > "$MYCONF" << HEADER
server {
    server_name $DOMAIN;

    root /var/www/html;
    index index.html;

    location / {
        try_files \$uri \$uri/ =404;
    }

HEADER

for dep in "${DEPLOYMENTS[@]}"; do
    name="${dep%%:*}"
    path="${dep##*:}"
    cat >> "$MYCONF" << EOF
    location /$name/ {
        alias $path;
        try_files $uri $uri/ /index.html;
    }

EOF
done

cat >> "$MYCONF" << SSL
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if (\$host = $DOMAIN) {
        return 301 https://\$host\$request_uri;
    }

    listen 80;
    server_name $DOMAIN;
    return 404;
}
SSL

sudo ln -sf "$MYCONF" "$SITES_ENABLED/mysite.conf"
sudo nginx -t 2>&1 && sudo systemctl reload nginx
echo "Generated $MYCONF with ${#DEPLOYMENTS[@]} deployment(s)"
