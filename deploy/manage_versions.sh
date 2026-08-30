#!/bin/bash

# Multi-Version Management Script for Hiker App
# Designed for use on a production Linux server with Nginx

INSTANCES_DIR="./instances"

# Derive version name from current directory
VERSION=$(basename "$(pwd)")

# Validate directory name for URL compatibility
if echo "$VERSION" | grep -q '[^a-zA-Z0-9-]'; then
    echo "Error: Directory name '$VERSION' contains invalid characters for a URL."
    echo "Allowed: letters, numbers, hyphens (-)."
    echo "Invalid: underscores (_), spaces, dots, etc."
    echo "Rename the directory and re-run."
    exit 1
fi

# Check running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "Error: This script must be run as root (sudo)."
    exit 1
fi

# Check required .env entries
ERRORS=0
if [ -f "server/.env" ]; then
    PORT=$(grep "^PORT=" server/.env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')
    if [ -z "$PORT" ]; then
        echo "Error: PORT not set in server/.env"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "Error: server/.env not found"
    exit 1
fi

if [ $ERRORS -gt 0 ]; then
    echo "Fix the errors above and re-run."
    exit 1
fi

usage() {
    echo "Usage: $0 {add|remove|list}"
    echo "  add       - Create a new version instance and Nginx config"
    echo "  remove    - Remove an instance and its Nginx config"
    echo "  list      - List all managed instances"
    exit 1
}

case "$1" in
    add)

        # Check for port conflicts across all instances in /var/www/html/
        if [ -d "/var/www/html" ]; then
            CONFLICT=""
            for envfile in /var/www/html/*/server/.env; do
                [ -f "$envfile" ] || continue
                OTHER_PORT=$(grep "^PORT=" "$envfile" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')
                OTHER_DIR=$(basename "$(dirname "$(dirname "$envfile")")")
                if [ "$OTHER_PORT" = "$PORT" ] && [ "$OTHER_DIR" != "$VERSION" ]; then
                    CONFLICT="$OTHER_DIR"
                    break
                fi
            done
            if [ -n "$CONFLICT" ]; then
                echo "Error: Port $PORT conflicts with instance '$CONFLICT' (/var/www/html/$CONFLICT/server/.env)"
                echo "Fix the port in server/.env and re-run."
                exit 1
            fi
        fi

        echo "Creating instance: $VERSION on port $PORT"

        # 1. Create instance directory
        mkdir -p "$INSTANCES_DIR/$VERSION"

        # 2. Generate systemd service file
        SVC_FILE="/etc/systemd/system/${VERSION}.service"
        if [ -f "$SVC_FILE" ]; then
            echo "  [WARN] Service file already exists: ${VERSION}.service"
        else
            cat > "$SVC_FILE" << EOF
[Unit]
Description=Hiker App - $VERSION
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$(pwd)/server
Environment=NODE_ENV=production
Environment=PORT=$PORT
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
            echo "  Created service file: ${VERSION}.service"
        fi

        # 3. Enable and start the service
        systemctl daemon-reload
        systemctl enable "$VERSION"
        systemctl start "$VERSION"
        echo "  Service started: $VERSION"

        # 4. Add nginx location block
        NGINX_CONF="/etc/nginx/sites-enabled/mysite.conf"
        if [ -f "$NGINX_CONF" ]; then
            if grep -q "location /${VERSION}/" "$NGINX_CONF"; then
                echo "  [SKIP] Nginx location block already exists for /${VERSION}/"
            else
                cp "$NGINX_CONF" "${NGINX_CONF}.bak"
                TEMP_FILE=$(mktemp)
                awk -v ver="$VERSION" '
                    /listen 443 ssl/ && !done {
                        print "    location /" ver "/ {"
                        print "        alias /var/www/html/" ver "/dist/;"
                        print "        try_files $uri $uri/ /" ver "/index.html;"
                        print "    }"
                        print ""
                        done=1
                    }
                    { print }
                ' "$NGINX_CONF" > "$TEMP_FILE"
                mv "$TEMP_FILE" "$NGINX_CONF"
                if ! nginx -t 2>&1; then
                    echo "  [ERROR] Nginx config invalid! Restoring backup..."
                    mv "${NGINX_CONF}.bak" "$NGINX_CONF"
                    exit 1
                fi
                rm -f "${NGINX_CONF}.bak"
                echo "  Added nginx location block for /${VERSION}/"
            fi
        else
            echo "  [WARN] Nginx config not found: $NGINX_CONF"
        fi

        echo "------------------------------------------------------------"
        echo "SUCCESS: Instance $VERSION is configured."
        echo "  Path:      /$VERSION/"
        echo "  Port:      $PORT"
        echo "Next Steps:"
        echo "1. Check status:"
        echo "   sudo systemctl status $VERSION"
        echo "   sudo journalctl -u $VERSION -f"
        echo "------------------------------------------------------------"
        ;;

    remove)
        echo "Removing instance: $VERSION"

        # 1. Stop and disable service
        systemctl stop "$VERSION" 2>/dev/null
        systemctl disable "$VERSION" 2>/dev/null
        rm -f "/etc/systemd/system/${VERSION}.service"

        # 2. Remove instance directory
        rm -rf "$INSTANCES_DIR/$VERSION"

        # 3. Remove nginx location block
        NGINX_CONF="/etc/nginx/sites-enabled/mysite.conf"
        if [ -f "$NGINX_CONF" ] && grep -q "location /${VERSION}/" "$NGINX_CONF"; then
            cp "$NGINX_CONF" "${NGINX_CONF}.bak"
            TEMP_FILE=$(mktemp)
            awk -v ver="$VERSION" '
                $0 ~ "^    location /" ver "/ \\{$" { skip=1; next }
                skip && $0 ~ "^    \\}$" { skip=0; next }
                skip { next }
                { print }
            ' "$NGINX_CONF" > "$TEMP_FILE"
            mv "$TEMP_FILE" "$NGINX_CONF"
            if ! nginx -t 2>&1; then
                echo "  [ERROR] Nginx config invalid! Restoring backup..."
                mv "${NGINX_CONF}.bak" "$NGINX_CONF"
                exit 1
            fi
            rm -f "${NGINX_CONF}.bak"
            echo "  Removed nginx location block for /${VERSION}/"
        fi

        echo "SUCCESS: Instance $VERSION removed."
        ;;

    list)
        echo "Managed Instances (in current project):"
        echo "-----------------"
        if [ -d "$INSTANCES_DIR" ]; then
            ls "$INSTANCES_DIR" | while read -r dir; do
                echo "- $dir"
            done
        else
            echo "No instances found."
        fi
        ;;

    *)
        usage
        ;;
esac
