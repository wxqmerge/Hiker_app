#!/bin/bash

# Generate /etc/nginx/sites-available/mysite.conf
# Run on the server: bash deploy/patch-mysite.sh
#
# Auto-detects deployment directories under /var/www/html/
# and generates a single mysite.conf with location blocks for each.
# For deployments that declare PORT in server/.env, the PWA manifest is
# proxied to that deployment's Express server so each install gets its own
# app name; the static dist/manifest.webmanifest always says "Hiker Trail App".

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

    # keep ?key= config URLs out of access.log (serve index.html in this
    # location via break, so access_log off applies to the whole request)
    location ~ ^/(?<app>[a-z0-9-]+)/dist/$ {
        access_log off;
        rewrite ^ /\$app/dist/index.html break;
    }

    location / {
        try_files \$uri \$uri/ =404;
    }

HEADER

for dep in "${DEPLOYMENTS[@]}"; do
    name="${dep%%:*}"
    path="${dep##*:}"
    port=$(grep -m1 '^PORT=' "$HTML_BASE/$name/server/.env" 2>/dev/null | cut -d= -f2- | tr -dc '0-9')

    if [ -n "$port" ]; then
        cat >> "$MYCONF" << EOF
    # PWA manifest -> Express (dynamic app name)
    location ~ ^/$name/manifest\\.webmanifest\$ {
        proxy_pass http://127.0.0.1:$port;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-App-Name $name;
    }

EOF
    fi

    cat >> "$MYCONF" << EOF
    location /$name/ {
        alias $path/;
        access_log off;
        try_files \$uri \$uri/ /$name/index.html;
    }

EOF
done

cat >> "$MYCONF" << SSL
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    client_max_body_size 20m;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if (\$host = $DOMAIN) {
        return 301 https://\$host\$request_uri;
    }

    listen 80;
    server_name $DOMAIN;
    client_max_body_size 20m;
    return 404;
}
SSL

sudo ln -sf "$MYCONF" "$SITES_ENABLED/mysite.conf"
sudo nginx -t 2>&1 && sudo systemctl reload nginx
echo "Generated $MYCONF with ${#DEPLOYMENTS[@]} deployment(s)"
