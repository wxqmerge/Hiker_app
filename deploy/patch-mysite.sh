#!/bin/bash

# Generate /etc/nginx/sites-available/mysite.conf for example.com
# Run on the server: bash deploy/patch-mysite.sh
#
# Auto-detects deployment directories under /var/www/html/
# and generates a single mysite.conf with location blocks for each.

SITES_DIR="/etc/nginx/sites-available"
SITES_ENABLED="/etc/nginx/sites-enabled"
HTML_BASE="/var/www/html"
MYCONF="$SITES_DIR/mysite.conf"

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
cat > "$MYCONF" << 'HEADER'
server {
    server_name example.com;

    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
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

cat >> "$MYCONF" << 'SSL'
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/bughouse-ladder.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bughouse-ladder.example.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = example.com) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    server_name example.com;
    return 404;
}
EOF

sudo ln -sf "$MYCONF" "$SITES_ENABLED/mysite.conf"
sudo nginx -t 2>&1 && sudo systemctl reload nginx
echo "Generated $MYCONF with ${#DEPLOYMENTS[@]} deployment(s)"
