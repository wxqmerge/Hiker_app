#!/bin/bash
# One-shot chess4.us -> hiker4.us transition for rp5 (run while BOTH zones
# exist in Cloudflare; re-running is safe).
#
#   cd /var/www/html/sothh-app && git pull && sudo bash deploy/migrate-hiker4.sh
#
# (git pull is deliberately NOT done here: this script runs as root, and a
# root-side pull would litter the checkout with root-owned files.)
#
# Steps:
#   1. ensure SERVER_NAMES="chess4.us hiker4.us" in server/.env
#   2. regenerate mysite.conf via patch-mysite.sh (it backs up + reloads)
#   3. add <app>.hiker4.us to every <app>.chess4.us nginx vhost
#   4. nginx -t + reload, then local end-to-end checks for every app
#      on both domains (subdomain vhosts AND path-style /<app>/api/)

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "Error: run with sudo"; exit 1; fi

SERVER_NAMES="${SERVER_NAMES:-chess4.us hiker4.us}"
OLD_DOMAIN="chess4.us"
NEW_DOMAIN="hiker4.us"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== [1/4] SERVER_NAMES=\"$SERVER_NAMES\" in server/.env ==="
ENV_FILE="$REPO_ROOT/server/.env"
[ -f "$ENV_FILE" ] || { echo "Error: $ENV_FILE not found"; exit 1; }
cp "$ENV_FILE" "$ENV_FILE.bak.hiker4"
if grep -q '^SERVER_NAMES=' "$ENV_FILE"; then
    sed -i "s/^SERVER_NAMES=.*/SERVER_NAMES=\"$SERVER_NAMES\"/" "$ENV_FILE"
    echo "  updated existing SERVER_NAMES"
else
    printf 'SERVER_NAMES="%s"\n' "$SERVER_NAMES" >> "$ENV_FILE"
    echo "  appended SERVER_NAMES"
fi

echo
echo "=== [2/4] regenerate mysite.conf (patch-mysite.sh) ==="
bash "$REPO_ROOT/deploy/patch-mysite.sh"

echo
echo "=== [3/4] extend subdomain vhosts with .$NEW_DOMAIN ==="
# Collect the real files behind sites-enabled (skip mysite.conf: regenerated
# above; skip plain-root and www server_names: not app vhosts).
FILES=""
for link in /etc/nginx/sites-enabled/*; do
    real=$(readlink -f "$link")
    base=$(basename "$real")
    [ "$base" = "mysite.conf" ] && continue
    case "$base" in *.bak*) continue ;; esac
    echo "$FILES" | grep -qx "$real" && continue
    grep -Eq "server_name[[:space:]]+[a-z0-9-]+\.${OLD_DOMAIN}([;.])" "$real" || continue
    FILES="$FILES$real"$'\n'
done

if [ -z "${FILES//$'\n'/}" ]; then
    echo "  (no .$OLD_DOMAIN app vhosts found - skipping)"
else
    echo "$FILES" | while read -r f; do
        [ -n "$f" ] || continue
        cp "$f" "$f.bak.hiker4"
        # "server_name X.chess4.us;" -> "server_name X.chess4.us X.hiker4.us;"
        # (skips www; skips lines that already mention the new domain)
        perl -pi -e "s/server_name ([a-z0-9-]+)\.${OLD_DOMAIN};/\$1 eq 'www' ? \$& : \"server_name \$1.${OLD_DOMAIN} \$1.${NEW_DOMAIN};\"/ge unless /\Q.${NEW_DOMAIN}\E;/" "$f"
        echo "  updated $f (backup: $f.bak.hiker4)"
    done
fi

echo
echo "=== [4/4] validate + self-test ==="
nginx -t
systemctl reload-or-restart nginx
sleep 1

APPS=$(grep -rhoE "server_name [a-z0-9-]+\.${OLD_DOMAIN}([ ;])" /etc/nginx/sites-enabled/ 2>/dev/null \
    | sed -E "s/server_name ([a-z0-9-]+)\.${OLD_DOMAIN}.*/\1/" | grep -vx www | sort -u)
[ -n "$APPS" ] || { echo "Error: no app vhosts detected to test"; exit 1; }

FAIL=0
for app in $APPS; do
    for host in "${app}.${OLD_DOMAIN}" "${app}.${NEW_DOMAIN}"; do
        code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 10 \
            --resolve "${host}:443:127.0.0.1" "https://${host}/api/config" || echo 000)
        [ "$code" = "200" ] && echo "  PASS subdomain  https://$host/api/config" \
                            || { echo "  FAIL subdomain  https://$host/api/config (HTTP $code)"; FAIL=1; }
    done
    for base in "$OLD_DOMAIN" "$NEW_DOMAIN"; do
        code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 10 \
            --resolve "${base}:443:127.0.0.1" "https://${base}/${app}/api/config" || echo 000)
        [ "$code" = "200" ] && echo "  PASS path-style https://$base/$app/api/config" \
                            || { echo "  FAIL path-style https://$base/$app/api/config (HTTP $code)"; FAIL=1; }
    done
done

echo
if [ "$FAIL" = "0" ]; then
    echo "ALL CHECKS PASSED. Both domains serve every app on rp5."
    echo "Next: verify from outside once Cloudflare has propagated:"
    echo "  curl -s https://sothh-dev.${NEW_DOMAIN}/api/config"
else
    echo "SOME CHECKS FAILED - inspect above. Backups: mysite.conf.bak, *.bak.hiker4"
    exit 1
fi
