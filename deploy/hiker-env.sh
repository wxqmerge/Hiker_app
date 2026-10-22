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

hiker_ensure_environment_file() {
    local service_file="$1"
    local env_file="$2"
    local marker="EnvironmentFile=${env_file}"
    local tmp_file

    [ -f "$service_file" ] || return 1
    [ -f "$env_file" ] || return 1

    if grep -qxF "$marker" "$service_file" 2>/dev/null; then
        return 0
    fi

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
