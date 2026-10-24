#!/bin/bash
# Shared helpers for protected API-key storage.

HIKER_SECRET_DIR="${HIKER_SECRET_DIR:-/etc/hiker}"
HIKER_SECRET_GROUP="${HIKER_SECRET_GROUP:-hiker-admin}"

hiker_run_as_root() {
    if [ "$(id -u)" -eq 0 ]; then
        "$@"
    else
        sudo "$@"
    fi
}

hiker_secret_file_for() {
    printf '%s/%s.env' "$HIKER_SECRET_DIR" "$1"
}

hiker_read_env_value() {
    local var="$1"
    shift

    local file value
    for file in "$@"; do
        [ -f "$file" ] || continue

        value=""
        if [ -r "$file" ]; then
            value=$(grep "^${var}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r\n')
        elif sudo -n true >/dev/null 2>&1; then
            value=$(sudo -n grep "^${var}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r\n')
        fi

        if [ -n "$value" ]; then
            printf '%s' "$value"
            return 0
        fi
    done

    return 1
}

hiker_has_env_value() {
    hiker_read_env_value "$@" >/dev/null 2>&1
}

hiker_prepare_secret_dir() {
    if getent group "$HIKER_SECRET_GROUP" >/dev/null 2>&1; then
        hiker_run_as_root install -d -m 750 -o root -g "$HIKER_SECRET_GROUP" "$HIKER_SECRET_DIR"
    else
        hiker_run_as_root install -d -m 700 -o root -g root "$HIKER_SECRET_DIR"
    fi
}

hiker_write_secret_file() {
    local secret_file="$1"
    local admin_key="$2"
    local tmp_file

    if [ -z "$admin_key" ]; then
        echo "Error: an admin API key is required." >&2
        return 1
    fi

    umask 077
    tmp_file=$(mktemp)
    printf 'ADMIN_API_KEY=%s\n' "$admin_key" > "$tmp_file"

    hiker_prepare_secret_dir
    if getent group "$HIKER_SECRET_GROUP" >/dev/null 2>&1; then
        chmod 640 "$tmp_file"
        hiker_run_as_root install -m 640 -o root -g "$HIKER_SECRET_GROUP" "$tmp_file" "$secret_file"
    else
        chmod 600 "$tmp_file"
        hiker_run_as_root install -m 600 -o root -g root "$tmp_file" "$secret_file"
    fi

    rm -f "$tmp_file"
}

hiker_remove_legacy_keys() {
    local env_file="$1"
    [ -f "$env_file" ] || return 0

    hiker_run_as_root sed -i '/^ADMIN_API_KEY=/d' "$env_file"
}

hiker_write_env_value() {
    local var="$1"
    local value="$2"
    local file="$3"
    local tmp_file

    [ -n "$var" ] || return 1
    [ -n "$value" ] || return 1
    [ -n "$file" ] || return 1

    umask 077
    tmp_file=$(mktemp)
    grep -v "^${var}=" "$file" > "$tmp_file" 2>/dev/null || true
    printf '%s=%s\n' "$var" "$value" >> "$tmp_file"
    hiker_run_as_root cp "$tmp_file" "$file"
    chmod 600 "$file" 2>/dev/null || hiker_run_as_root chmod 600 "$file" 2>/dev/null || true
    rm -f "$tmp_file"
}

hiker_set_service_option() {
    local service_file="$1"
    local key="$2"
    local value="$3"
    local desired="$key=$value"
    local tmp_file

    [ -f "$service_file" ] || return 1
    [ -n "$key" ] || return 1

    if grep -qxF "$desired" "$service_file" 2>/dev/null; then
        return 0
    fi

    tmp_file=$(mktemp)
    awk -v key="$key" -v desired="$desired" '
        BEGIN { in_service = 0; replaced = 0 }
        /^\[Service\]/ {
            in_service = 1
            print
            next
        }
        in_service && /^\[/ {
            if (!replaced) print desired
            replaced = 1
            in_service = 0
            print
            next
        }
        in_service && $0 ~ "^" key "=" {
            print desired
            replaced = 1
            next
        }
        { print }
        END {
            if (in_service && !replaced) print desired
        }
    ' "$service_file" > "$tmp_file"

    if ! grep -qxF "$desired" "$tmp_file" 2>/dev/null; then
        rm -f "$tmp_file"
        return 1
    fi

    hiker_run_as_root cp "$tmp_file" "$service_file"
    rm -f "$tmp_file"
}

hiker_ensure_environment_file() {
    local service_file="$1"
    local env_file="$2"
    local marker="EnvironmentFile=${env_file}"
    local optional_marker="EnvironmentFile=-${env_file}"
    local tmp_file

    [ -f "$service_file" ] || return 1

    if grep -qxF "$optional_marker" "$service_file" 2>/dev/null &&
       grep -qxF "$marker" "$service_file" 2>/dev/null; then
        tmp_file=$(mktemp)
        awk -v remove_line="$marker" '$0 != remove_line' "$service_file" > "$tmp_file"
        hiker_run_as_root cp "$tmp_file" "$service_file"
        rm -f "$tmp_file"
        return 0
    fi

    if grep -qxF "$optional_marker" "$service_file" 2>/dev/null ||
       grep -qxF "$marker" "$service_file" 2>/dev/null; then
        return 0
    fi

    [ -f "$env_file" ] || return 1

    tmp_file=$(mktemp)
    awk -v insert_line="$marker" 'BEGIN { inserted = 0 }
        !inserted && /^ExecStart=/ {
            print insert_line
            inserted = 1
        }
        { print }
    ' "$service_file" > "$tmp_file"

    if grep -qxF "$marker" "$tmp_file" 2>/dev/null; then
        hiker_run_as_root cp "$tmp_file" "$service_file"
        hiker_run_as_root systemctl daemon-reload >/dev/null 2>&1 || true
        rm -f "$tmp_file"
        return 0
    fi

    rm -f "$tmp_file"
    return 1
}

# Ask the RUNNING server whether it actually holds an admin key, without needing
# root. Sets HIKER_ADMIN_PROBE_CODE to the HTTP status and returns:
#   0 = key is loaded (401 rejects our deliberately missing header; 429 means the
#       limiter answered, which it can only do behind a configured key)
#   1 = the process has NO key (403 "ADMIN_API_KEY not configured")
#   2 = inconclusive (nothing answering, no curl, no base url)
#
# Why a live probe belongs next to the file checks at all:
#   - hiker_read_env_value falls back to `sudo -n grep`, so a key that root can
#     read and the service user cannot is "set" to every file-based check;
#   - `EnvironmentFile=-<path>` makes an unreadable file a SILENT no-op, so the
#     service starts, answers /health with 200, and every admin route 403s;
#   - /proc/<pid>/environ is the right source but is root-only, so verify.sh can
#     only warn when it is run without passwordless sudo.
# requireAdminKey tests ADMIN_API_KEY *before* it reads the request header, which
# is exactly what makes a keyless GET /api/auth/verify an oracle for the process
# environment rather than for the caller's key. Failed tries are what the limiter
# counts (skipSuccessfulRequests), so do not call this in a loop.
hiker_probe_admin_key_loaded() {
    local base="${1:-}"
    base="${base%/}"

    HIKER_ADMIN_PROBE_CODE="000"

    [ -n "$base" ] || return 2
    command -v curl >/dev/null 2>&1 || return 2

    # Auth failures sleep ~1s each (ADMIN_AUTH_FAILURE_DELAY_MS), hence the 10s cap.
    # curl prints 000 itself when it could not connect, so no `|| echo` here: that
    # appends a second 000 to the one it already wrote and yields 000000.
    HIKER_ADMIN_PROBE_CODE=$(curl -sk --max-time 10 -o /dev/null -w '%{http_code}' \
        "$base/api/auth/verify" 2>/dev/null)
    HIKER_ADMIN_PROBE_CODE=$(printf '%s' "$HIKER_ADMIN_PROBE_CODE" | tr -dc '0-9')
    [ -n "$HIKER_ADMIN_PROBE_CODE" ] || HIKER_ADMIN_PROBE_CODE="000"

    case "$HIKER_ADMIN_PROBE_CODE" in
        401|429) return 0 ;;
        403) return 1 ;;
        *) return 2 ;;
    esac
}
