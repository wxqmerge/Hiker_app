#!/bin/bash
# Ensure every hiker instance's CORS_ORIGINS allows BOTH domains so the
# path-style pages (https://<domain>/<app>/) may call the subdomain APIs
# (<app>.<domain>/api) cross-origin during the chess4.us -> hiker4.us period.
#
#   sudo bash deploy/set-cors-both-domains.sh                 # auto-detect all
#   sudo bash deploy/set-cors-both-domains.sh sothh-app travel-app   # explicit dirs
#
# IMPORTANT: the server runtime loads the instance ROOT .env (server/src/utils
# /env.ts resolves to ../../../.env after the flattened build), while deploy
# scripts read server/.env. Both are updated here when present. Note that
# dotenv does NOT override a variable the systemd unit already sets - if
# "systemctl cat <unit>" shows Environment=CORS_ORIGINS=..., edit the unit or a
# drop-in too; the runtime-env check at the end reveals which value is live.
#
# Existing origins are kept; '*' is left untouched; each file is backed up as
# .env.bak.cors; the systemd unit matching the directory name is restarted;
# finally the process's ACTUAL CORS_ORIGINS/PORT are read from /proc and an
# ACAO probe is issued against that port. Re-running is a no-op when done.

set -euo pipefail
if [ "$(id -u)" -ne 0 ] && [ "${ALLOW_NONROOT:-0}" != "1" ]; then echo "Error: run with sudo"; exit 1; fi

REQUIRED="https://chess4.us https://hiker4.us"
BASE="${BASE:-/var/www/html}"

is_hiker_dir() {
    local d="$1"
    for f in "$d/.env" "$d/server/.env"; do
        [ -f "$f" ] && grep -q '^PORT=' "$f" && grep -q '^ADMIN_API_KEY=' "$f" && return 0
    done
    return 1
}

DIRS=()
if [ "$#" -gt 0 ]; then
    for name in "$@"; do DIRS+=("$BASE/$name"); done
else
    for d in "$BASE"/*/; do
        d="${d%/}"
        is_hiker_dir "$d" && DIRS+=("$d")
    done
fi
[ "${#DIRS[@]}" -gt 0 ] || { echo "No hiker instance .env files found"; exit 1; }

update_env_file() {  # $1=file -> prints action line, exit 0 touched/changed
    local env="$1" cur list new
    cur=$(grep -m1 '^CORS_ORIGINS=' "$env" | cut -d= -f2- | tr -d "\"'" || true)
    [ "$cur" = "*" ] && { echo "        $env: '*' - left as is"; return 1; }
    list=$(echo "$cur" | tr ',' ' ')
    for want in $REQUIRED; do
        case " $list " in *" $want "*) ;; *) list="$list $want" ;; esac
    done
    if [ "$(echo "$cur" | tr ',' '\n' | sort -u | tr '\n' ' ')" = "$(echo $list | tr ' ' '\n' | sort -u | tr '\n' ' ')" ]; then
        echo "        $env: already set ($cur)"; return 1
    fi
    new=$(echo $list | tr ' ' ',')
    cp "$env" "$env.bak.cors"
    if grep -q '^CORS_ORIGINS=' "$env"; then
        sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=$new|" "$env"
    else
        printf 'CORS_ORIGINS=%s\n' "$new" >> "$env"
    fi
    echo "        SET $env: [$cur] -> [$new]"; return 0
}

TOTAL_CHANGED=0
for dir in "${DIRS[@]}"; do
    name=$(basename "$dir")
    echo "== $name"
    touched=0
    for env in "$dir/.env" "$dir/server/.env"; do
        [ -f "$env" ] || continue
        if update_env_file "$env"; then touched=1; fi
    done

    if ! systemctl list-unit-files "${name}.service" --no-legend 2>/dev/null | grep -q "${name}.service"; then
        [ "$touched" = "1" ] && echo "      NOTE: no unit ${name}.service - restart its service manually (runtime keeps old CORS until restart)"
        continue
    fi
    if [ "$touched" = "1" ]; then
        systemctl restart "${name}.service"
        echo "      restarted ${name}.service ($(systemctl is-active "${name}.service"))"
        sleep 1
    fi

    # Ground truth: the LIVE process environment, then an ACAO probe on its port
    mpid=$(systemctl show -p MainPID --value "${name}.service" 2>/dev/null || true)
    port=""
    if [ -n "${mpid:-}" ] && [ "$mpid" != "0" ] && [ -r "/proc/$mpid/environ" ]; then
        live=$(tr '\0' '\n' < "/proc/$mpid/environ" | grep -E '^(CORS_ORIGINS|PORT)=' | tr '\n' ' ' || true)
        echo "      live process env: ${live:-<neither set - inherits shell/unit>}"
        port=$(echo "${live:-}" | tr ' ' '\n' | sed -n 's/^PORT=//p' | head -1)
    fi
    [ -n "$port" ] || port=$(grep -h -m1 '^PORT=' "$dir/.env" "$dir/server/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]')
    if [ -n "$port" ]; then
        hit=$(curl -s -o /dev/null -D - -H 'Origin: https://hiker4.us' --max-time 5 "http://127.0.0.1:${port}/api/config" 2>/dev/null | grep -ic 'access-control-allow-origin: https://hiker4.us' || true)
        echo "      ACAO(hiker4.us) on 127.0.0.1:${port}: $([ "${hit:-0}" -ge 1 ] && echo PASS || echo FAIL)"
    fi
done

echo
echo "External re-check when done: curl -s -o /dev/null -D - -H 'Origin: https://hiker4.us' https://sothh-dev.hiker4.us/api/config | grep -i access-control"
