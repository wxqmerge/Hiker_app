#!/bin/bash

# Ensure each hiker deployment can be reached via both its domain and example.com
# Run on the server: bash deploy/patch-mysite.sh
#
# Auto-detects deployment directories under /var/www/html/
# and ensures the matching nginx config includes example.com in server_name.

sites_dir="/etc/nginx/sites-available"
html_base="/var/www/html"

for dir in "$html_base"/*/; do
    [ -d "$dir" ] || continue
    subdir=$(basename "$dir")
    dist_dir="$dir/dist"

    # Skip if no built dist/ exists
    [ -d "$dist_dir" ] || continue

    conf="$sites_dir/$subdir"
    if [ ! -f "$conf" ]; then
        echo "WARNING: No config found for $subdir at $conf"
        continue
    fi

    # Ensure example.com is in server_name
    if grep -q "server_name.*example.com" "$conf"; then
        echo "Skipping $subdir (server_name already includes example.com)"
        continue
    fi

    # Add example.com to all server_name directives
    sudo sed -i 's/server_name \(.*\).example.com;/server_name \1.example.com example.com;/g' "$conf"
    echo "Added example.com to server_name in $conf"

    # Ensure location block exists for this subdir
    if ! grep -q "location /$subdir/" "$conf"; then
        sudo sed -i "/^    listen 443 ssl;/i\\
    location /$subdir/ {\\
        alias '"$dist_dir"';\\
        try_files \$uri \$uri/ /index.html;\\
    }\\
" "$conf"
        echo "Added /$subdir/ location block to $conf"
    fi
done

sudo nginx -t 2>&1 && sudo systemctl reload nginx
echo "Done."
