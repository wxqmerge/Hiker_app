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

echo "=== [1/4] SERVER_NAMES in every hiker app's server/.env (\"$SERVER_NAMES\"; *-dev: chess4 only) ==="
# Stamp ALL hiker checkouts (not just this one): update.sh derives each app's
# nginx server_name list from its own server/.env, so every instance must know
# about hiker4.us or its next deploy wipes the hiker4 subdomain again.
# *-dev instances stay on chess4.us by owner request: they get the old domain
# only, so their next update.sh re-renders a chess4-only vhost.
STAMPED=0
for ENV_FILE in /var/www/html/*/server/.env; do
    [ -f "$ENV_FILE" ] || continue
    APP_DIR="$(dirname "$(dirname "$ENV_FILE")")"
    APP="$(basename "$APP_DIR")"
    [ -f "$APP_DIR/deploy/hiker.conf.example" ] || continue  # not a hiker app checkout
    NAMES="$SERVER_NAMES"
    case "$APP" in *-dev) NAMES="$OLD_DOMAIN" ;; esac
    cp "$ENV_FILE" "$ENV_FILE.bak.hiker4"
    if grep -q '^SERVER_NAMES=' "$ENV_FILE"; then
        sed -i "s/^SERVER_NAMES=.*/SERVER_NAMES=\"$NAMES\"/" "$ENV_FILE"
        echo "  $APP: SERVER_NAMES=\"$NAMES\""
    else
        printf 'SERVER_NAMES="%s"\n' "$NAMES" >> "$ENV_FILE"
        echo "  $APP: appended SERVER_NAMES=\"$NAMES\""
    fi
    STAMPED=$((STAMPED+1))
done
[ "$STAMPED" -gt 0 ] || { echo "Error: no hiker app server/.env found under /var/www/html"; exit 1; }

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
        base=$(basename "$f")
        cp "$f" "$f.bak.hiker4"
        case "$base" in
            *-dev)
                # *-dev stays on chess4.us by owner request: strip any
                # <app>.hiker4.us alias an earlier run added, keeping
                # "server_name <app>.chess4.us;" alone.
                perl -pi -e "s/[ ]+\Q${base}\E\.${NEW_DOMAIN}(?= *[;.])//g if /server_name .*\.${OLD_DOMAIN}/;" "$f"
                echo "  trimmed $NEW_DOMAIN alias from $base vhost (backup: $f.bak.hiker4)"
                ;;
            *)
                # "server_name X.chess4.us;" -> "server_name X.chess4.us X.hiker4.us;"
                # (skips www; skips lines that already mention the new domain)
                perl -pi -e "s/server_name ([a-z0-9-]+)\.${OLD_DOMAIN};/\$1 eq 'www' ? \$& : \"server_name \$1.${OLD_DOMAIN} \$1.${NEW_DOMAIN};\"/ge unless /\Q.${NEW_DOMAIN}\E;/" "$f"
                echo "  updated $f (backup: $f.bak.hiker4)"
                ;;
        esac
    done
fi

echo
echo "=== [4/4] validate + self-test ==="
nginx -t
systemctl reload-or-restart nginx
sleep 1

APPS=$(grep -RhoE "server_name [a-z0-9-]+\.${OLD_DOMAIN}([ ;])" /etc/nginx/sites-enabled/ 2>/dev/null \
    | sed -E "s/server_name ([a-z0-9-]+)\.${OLD_DOMAIN}.*/\1/" | grep -vx www | sort -u)
[ -n "$APPS" ] || { echo "Error: no app vhosts detected to test"; exit 1; }

FAIL=0
for app in $APPS; do
    case "$app" in
        *-dev)
            # *-dev lives on chess4 only: its chess4 subdomain must serve and
            # its hiker4 subdomain must NOT (no matching server_name anymore).
            code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 10 \
                --resolve "${app}.${OLD_DOMAIN}:443:127.0.0.1" "https://${app}.${OLD_DOMAIN}/api/config" || echo 000)
            [ "$code" = "200" ] && echo "  PASS subdomain  https://$app.$OLD_DOMAIN/api/config" \
                                || { echo "  FAIL subdomain  https://$app.$OLD_DOMAIN/api/config (HTTP $code)"; FAIL=1; }
            code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 10 \
                --resolve "${app}.${NEW_DOMAIN}:443:127.0.0.1" "https://${app}.${NEW_DOMAIN}/api/config" || echo 000)
            [ "$code" != "200" ] && echo "  PASS subdomain  https://$app.$NEW_DOMAIN/api/config absent as intended (HTTP $code)" \
                                || { echo "  FAIL subdomain  https://$app.$NEW_DOMAIN/api/config still served (HTTP $code)"; FAIL=1; }
            ;;
        *)
            for host in "${app}.${OLD_DOMAIN}" "${app}.${NEW_DOMAIN}"; do
                code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 10 \
                    --resolve "${host}:443:127.0.0.1" "https://${host}/api/config" || echo 000)
                [ "$code" = "200" ] && echo "  PASS subdomain  https://$host/api/config" \
                                    || { echo "  FAIL subdomain  https://$host/api/config (HTTP $code)"; FAIL=1; }
            done
            ;;
    esac
    # path-style api endpoints stay served on both domains for every app
    # (page paths may redirect between domains; /api/ and /health never do)
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
