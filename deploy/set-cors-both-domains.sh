#!/bin/bash
# Ensure every hiker instance's CORS_ORIGINS allows BOTH domains so the
# path-style pages (https://<domain>/<app>/) may call the subdomain APIs
# (<app>.<domain>/api) cross-origin during the chess4.us -> hiker4.us period.
#
#   sudo bash deploy/set-cors-both-domains.sh                 # auto-detect all
#   sudo bash deploy/set-cors-both-domains.sh sothh-app travel-app   # explicit dirs
#
# Auto-detect = every /var/www/html/*/server/.env that looks like a hiker
# instance (has PORT= and ADMIN_API_KEY=). Existing origins are kept;
# a value of '*' is left untouched. Each .env is backed up as .env.bak.cors.
# Restarts the systemd unit whose name matches the instance directory when
# such a unit exists. Re-running is a no-op when the origins are already set.

set -euo pipefail
if [ "$(id -u)" -ne 0 ] && [ "${ALLOW_NONROOT:-0}" != "1" ]; then echo "Error: run with sudo"; exit 1; fi

REQUIRED="https://chess4.us https://hiker4.us"
BASE="${BASE:-/var/www/html}"

DIRS=()
if [ "$#" -gt 0 ]; then
    for name in "$@"; do DIRS+=("$BASE/$name"); done
else
    for env in "$BASE"/*/server/.env; do
        [ -f "$env" ] || continue
        grep -q '^PORT=' "$env" && grep -q '^ADMIN_API_KEY=' "$env" && DIRS+=("$(dirname "$(dirname "$env")")")
    done
fi

[ "${#DIRS[@]}" -gt 0 ] || { echo "No hiker instance .env files found"; exit 1; }

CHANGED=0
for dir in "${DIRS[@]}"; do
    env="$dir/server/.env"
    name=$(basename "$dir")
    if [ ! -f "$env" ]; then echo "SKIP  $name: $env not found"; continue; fi

    cur=$(grep -m1 '^CORS_ORIGINS=' "$env" | cut -d= -f2- | tr -d "\"'" || true)

    if [ "$cur" = "*" ]; then
        echo "SKIP  $name: CORS_ORIGINS is * (allows everything already)"
        continue
    fi

    list=$(echo "$cur" | tr ',' ' ')
    for want in $REQUIRED; do
        case " $list " in *" $want "*) ;; *) list="$list $want" ;; esac
    done
    # trim leading space, join with commas
    new=$(echo $list | tr ' ' ',')

    if [ "$(echo "$cur" | tr ',' '\n' | sort -u | tr '\n' ' ')" = "$(echo $list | tr ' ' '\n' | sort -u | tr '\n' ' ')" ]; then
        echo "OK    $name: already set ($cur)"
        continue
    fi

    cp "$env" "$env.bak.cors"
    if grep -q '^CORS_ORIGINS=' "$env"; then
        sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=$new|" "$env"
    else
        printf 'CORS_ORIGINS=%s\n' "$new" >> "$env"
    fi
    echo "SET   $name: $cur -> $new (backup: $env.bak.cors)"
    CHANGED=1

    if systemctl list-unit-files "${name}.service" --no-legend 2>/dev/null | grep -q "${name}.service"; then
        systemctl restart "${name}.service"
        echo "      restarted ${name}.service ($(systemctl is-active "${name}.service"))"
    else
        echo "      NOTE: no unit named ${name}.service - restart its service manually"
    fi
done

if [ "$CHANGED" = "1" ]; then
    sleep 2
    echo
    echo "Verify ACAO for the new origin (should echo https://hiker4.us):"
    for dir in "${DIRS[@]}"; do
        [ -f "$dir/server/.env" ] || continue
        port=$(grep -m1 '^PORT=' "$dir/server/.env" | cut -d= -f2- | tr -d '[:space:]')
        [ -n "$port" ] || continue
        code=$(curl -s -o /dev/null -D - -H 'Origin: https://hiker4.us' --max-time 5 "http://127.0.0.1:${port}/api/config" 2>/dev/null | grep -ic 'access-control-allow-origin: https://hiker4.us' || true)
        echo "  $(basename "$dir") (port ${port}): ACAO-for-hiker4.us $([ "$code" -ge 1 ] && echo PASS || echo FAIL)"
    done
else
    echo "Nothing to change."
fi
