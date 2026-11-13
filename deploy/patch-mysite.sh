#!/bin/bash

# Generate /etc/nginx/sites-available/mysite.conf
# Run on the server: bash deploy/patch-mysite.sh
#
# Auto-detects deployment directories under /var/www/html/
# and generates a single mysite.conf with location blocks for each.
# For deployments that declare PORT in server/.env, the API routes and PWA
# manifest are proxied to that deployment's Express server (each install gets
# its own API + app name; the static dist/manifest.webmanifest always says
# "Hiker Trail App"). Without the /<name>/api/ proxy the SPA try_files
# fallback answers API calls with index.html (200 + HTML) and the app shows
# zero data - keep these blocks in sync with deploy/hiker.conf.example.

SITES_DIR="/etc/nginx/sites-available"
SITES_ENABLED="/etc/nginx/sites-enabled"
HTML_BASE="/var/www/html"
MYCONF="$SITES_DIR/mysite.conf"

# Server names: SERVER_NAMES (space-separated, first instance that declares it
# wins) lets one vhost answer several domains, e.g. during a domain migration:
#   SERVER_NAMES="chess4.us hiker4.us"
# Otherwise fall back to the first DOMAIN= found.
SERVER_NAMES=""
for dir in "$HTML_BASE"/*/; do
    [ -d "$dir" ] || continue
    if [ -f "$dir/server/.env" ] && grep -q '^SERVER_NAMES=' "$dir/server/.env"; then
        # strip surrounding quotes a .env may use (SERVER_NAMES="a b");
        # hostnames never contain quotes, spaces between names are kept
        SERVER_NAMES=$(grep -m1 '^SERVER_NAMES=' "$dir/server/.env" | cut -d= -f2- | tr -d "\"'")
        break
    fi
done
if [ -z "$SERVER_NAMES" ]; then
    for dir in "$HTML_BASE"/*/; do
        [ -d "$dir" ] || continue
        if [ -f "$dir/server/.env" ] && grep -q '^DOMAIN=' "$dir/server/.env"; then
            SERVER_NAMES=$(grep '^DOMAIN=' "$dir/server/.env" | head -1 | cut -d= -f2- | tr -d '[:space:]')
            break
        fi
    done
fi
SERVER_NAMES="${SERVER_NAMES:-example.com}"
echo "Server names: $SERVER_NAMES"
# Cert dir + ACME stay on the first name; the :80 redirect matches all names.
PRIMARY_DOMAIN=${SERVER_NAMES%% *}
HOST_REGEX=$(echo "$SERVER_NAMES" | tr ' ' '\n' | sed 's/\./\\./g' | paste -sd'|')

# Legacy-domain migration: hiker apps (those carrying deploy/hiker.conf.example)
# get their chess4.us PAGE paths 302'd to the second SERVER_NAMES domain
# (hiker4.us), same path + query. Their /api/ and /health paths KEEP serving on
# the old domain: 301/302 turns PUT/POST into GET when followed, and installed
# PWAs keep calling the old origin until they are re-added.
# Use 302, not 301, while the new domain is young: browsers cache permanent
# redirects forever, and new domains sit in DNS blocklists (NextDNS nrd~month
# sinkholed hiker4.us until allowlisted) - a cached 301 would strand those
# users even on the old domain that still works. Flip to 301 once the new
# domain has aged out of the block feeds (~60 days).
SECOND_DOMAIN=$(echo "$SERVER_NAMES" | tr ' ' '\n' | sed -n '2p')
LEGACY_REDIRECT_STATUS=302

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

# Back up the previous config: this script regenerates mysite.conf from
# scratch, so any hand-edited locations are otherwise lost silently.
if [ -f "$MYCONF" ]; then
    cp "$MYCONF" "$MYCONF.bak.$(date +%Y%m%d-%H%M%S)"
    cp "$MYCONF" "$MYCONF.bak"
    echo "Backed up existing config to $MYCONF.bak"
fi

# Generate the config
cat > "$MYCONF" << HEADER
server {
    server_name $SERVER_NAMES;

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
    # API + health -> Express (prefix /$name stripped by proxy_pass URI)
    location /$name/api/ {
        proxy_pass http://127.0.0.1:$port/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-App-Name $name;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    location /$name/health {
        proxy_pass http://127.0.0.1:$port/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

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

    # Legacy-domain redirect for hiker apps (see LEGACY_REDIRECT_STATUS above).
    redirect_block=""
    dist_block=""
    if [ -n "$SECOND_DOMAIN" ] && [ -f "$HTML_BASE/$name/deploy/hiker.conf.example" ]; then
        redirect_block="
        if (\$host = $PRIMARY_DOMAIN) { return $LEGACY_REDIRECT_STATUS https://$SECOND_DOMAIN\$request_uri; }"
        # exact-match so it wins over the shared /<app>/dist/ regex shortcut above
        dist_block="
    location = /$name/dist/ {
        if (\$host = $PRIMARY_DOMAIN) { return $LEGACY_REDIRECT_STATUS https://$SECOND_DOMAIN\$request_uri; }
        rewrite ^ /$name/dist/index.html break;
    }
"
    fi

    cat >> "$MYCONF" << EOF
    location /$name/ {$redirect_block
        alias $path/;
        access_log off;
        try_files \$uri \$uri/ /$name/index.html;
    }
$dist_block
EOF
done

cat >> "$MYCONF" << SSL
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/$PRIMARY_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$PRIMARY_DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    client_max_body_size 20m;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if (\$host ~ ^($HOST_REGEX)\$) {
        return 301 https://\$host\$request_uri;
    }

    listen 80;
    server_name $SERVER_NAMES;
    client_max_body_size 20m;
    return 404;
}
SSL

sudo ln -sf "$MYCONF" "$SITES_ENABLED/mysite.conf"
sudo nginx -t 2>&1 && sudo systemctl reload-or-restart nginx
echo "Generated $MYCONF with ${#DEPLOYMENTS[@]} deployment(s)"
