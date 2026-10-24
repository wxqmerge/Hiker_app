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

    # Trim and de-CR on the way IN. A key typed at a prompt or pasted from a
    # Windows-y file can carry \r or outer whitespace, and nothing on this box will
    # ever show it to you: hiker_read_env_value strips \r (tr -d '\r\n') and the UI
    # trims what you type (client.js:58), while systemd hands the process
    # ADMIN_API_KEY=<key>\r and requireAdminKey hashes it verbatim. Result: a
    # "verified present" key that matches nothing the browser sends.
    admin_key="$(hiker_sanitize_secret "$admin_key")"

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

    hiker_assert_secret_file "$secret_file" || return 1
    return 0
}

# Confirm a secret file the way SYSTEMD will read it, not the way grep-as-root does:
# exactly one non-empty ADMIN_API_KEY line and no carriage returns anywhere.
hiker_assert_secret_file() {
    local file="${1:-}"
    local present crlf

    [ -n "$file" ] || return 1

    present=$(hiker_run_as_root grep -c '^ADMIN_API_KEY=.' "$file" 2>/dev/null | tr -dc '0-9' || true)
    [ -n "$present" ] || present=0
    if [ "$present" != "1" ]; then
        echo "Error: $file does not contain exactly one non-empty ADMIN_API_KEY line." >&2
        return 1
    fi

    # Count CR BYTES in the stream. The obvious attempts are worse: $'\r' in argv
    # becomes an empty grep pattern under a shell that does not expand it (and that
    # pattern matches every line, so a clean file reports as corrupt), and awk on some
    # builds opens files in text mode and never sees a CRLF's \r at all. cat | tr | wc
    # is byte-exact everywhere and needs no privileged file open beyond cat.
    crlf=$(hiker_run_as_root cat "$file" 2>/dev/null | tr -dc '\r' | wc -c | tr -dc '0-9' || true)
    [ -n "$crlf" ] || crlf=0
    if [ "$crlf" != "0" ]; then
        echo "Error: $file contains carriage returns. The service would get a key ending" >&2
        echo "       in \\r and every browser key would then be rejected with 401." >&2
        echo "       Fix: sudo sed -i 's/\\r\$//' $file && sudo systemctl restart <service>" >&2
        return 1
    fi

    return 0
}

# Trim CR/LF and outer whitespace, keeping inner characters. Matches what the UI
# already does to a typed key (String(apiKey).trim(), client.js:58) so the stored
# value and the value the browser sends hash the same.
hiker_sanitize_secret() {
    local value="${1:-}"

    value=$(printf '%s' "$value" | tr -d '\r\n')
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"

    printf '%s' "$value"
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

    value="$(hiker_sanitize_secret "$value")"
    [ -n "$value" ] || return 1

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

# Print the PID listening on a TCP port, or nothing. `lsof` is not installed on
# every box, and the deploy script's `sudo lsof ... || true` used to fail SILENTLY:
# an empty result was read as "port free", the stale process survived the deploy,
# and the freshly started service died at once with EADDRINUSE while systemd
# restart-looped it every 5s. ss ships with iproute2, which is on essentially every
# Linux; prefer it and fall back to lsof. Process names need root for other users'
# PIDs, so retry with passwordless sudo when the first pass shows no pid.
hiker_port_owner_pid() {
    local port="${1:-}"
    local out=""

    [ -n "$port" ] || return 1

    if command -v ss >/dev/null 2>&1; then
        out=$(ss -ltnp "sport = :$port" 2>/dev/null | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
        if [ -z "$out" ] && sudo -n true >/dev/null 2>&1; then
            out=$(sudo -n ss -ltnp "sport = :$port" 2>/dev/null | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
        fi
    elif command -v lsof >/dev/null 2>&1; then
        out=$(lsof -ti ":$port" 2>/dev/null | head -1)
        if [ -z "$out" ] && sudo -n true >/dev/null 2>&1; then
            out=$(sudo -n lsof -ti ":$port" 2>/dev/null | head -1)
        fi
    else
        return 1
    fi

    [ -n "$out" ] || return 1
    printf '%s' "$out"
}

# The user the service actually runs as. An empty User= means root to systemd.
hiker_service_user() {
    local service="${1:-}"
    local user=""

    [ -n "$service" ] || return 1

    user=$(systemctl show -p User --value "$service" 2>/dev/null || echo "")
    [ -n "$user" ] || user=$(hiker_run_as_root systemctl show -p User --value "$service" 2>/dev/null || echo "")
    [ -n "$user" ] || user="root"

    printf '%s' "$user"
}

# The readability that matters: can the ACCOUNT THAT RUNS THE SERVICE read the file?
# Every other check in this repo reads as root (hiker_read_env_value's sudo fallback,
# verify.sh's /proc access), and root can read a 0600 root:root file all day while the
# process gets nothing. Running test -r AS that user also exercises directory
# traversal, which bites first: $HIKER_SECRET_DIR is 750 root:$HIKER_SECRET_GROUP.
hiker_secret_readable_by() {
    local user="${1:-}"
    local file="${2:-}"

    [ -n "$user" ] && [ -f "$file" ] || return 1
    [ "$user" = "root" ] && return 0
    [ "$(id -u)" = "0" ] || sudo -n true >/dev/null 2>&1 || return 1

    sudo -n -u "$user" test -r "$file" 2>/dev/null
}

# Put the service account in the group that can reach the secrets, and match the
# ownership to it. Nothing did this before: secure-env.sh adds the INTERACTIVE admin
# user, so a rotation moved the key into a directory the service cannot enter, and
# `EnvironmentFile=-` skipped the unreadable file without a word — a green deploy
# whose every admin route then answers 403 "ADMIN_API_KEY not configured".
hiker_grant_secret_access() {
    local user="${1:-}"
    local file="${2:-}"
    local group="${HIKER_SECRET_GROUP:-hiker-admin}"

    [ -n "$user" ] || return 1

    hiker_prepare_secret_dir
    if [ "$user" != "root" ] && ! id -nG "$user" 2>/dev/null | grep -qw "$group"; then
        hiker_run_as_root usermod -aG "$group" "$user" || return 1
        echo "  Granted $user membership of $group"
    fi

    if [ -n "$file" ] && [ -f "$file" ]; then
        hiker_run_as_root chgrp "$group" "$file" 2>/dev/null || true
        hiker_run_as_root chmod 640 "$file" 2>/dev/null || true
    fi

    return 0
}

# Verify a key change LANDED, end to end: readable by the service account, free of
# carriage returns, and actually present in the restarted process. Call it AFTER the
# restart. Prints the fix and returns non-zero, so a rotation can stop reporting a
# success it did not get.
hiker_verify_admin_key_after_change() {
    local service="${1:-}"
    local port="${2:-}"
    local secret_file user crlf

    [ -n "$service" ] || return 1

    secret_file="$(hiker_secret_file_for "$service")"
    user="$(hiker_service_user "$service")"

    if [ -f "$secret_file" ]; then
        if ! hiker_secret_readable_by "$user" "$secret_file"; then
            echo "  ERROR: $user cannot read $secret_file."
            echo "    sudo ls -ld $HIKER_SECRET_DIR $secret_file"
            echo "    sudo usermod -aG $HIKER_SECRET_GROUP $user && sudo systemctl restart $service"
            return 1
        fi

        crlf=$(hiker_run_as_root cat "$secret_file" 2>/dev/null | tr -dc '\r' | wc -c | tr -dc '0-9' || true)
        [ -n "$crlf" ] || crlf=0
        if [ "$crlf" != "0" ]; then
            echo "  ERROR: $secret_file has carriage returns — the process holds a key ending"
            echo "  in \\r, which hashes differently and rejects every browser key with 401:"
            echo "    sudo sed -i 's/\\r\$//' $secret_file && sudo systemctl restart $service"
            return 1
        fi
    fi

    [ -n "$port" ] || return 0

    if hiker_probe_admin_key_loaded "http://localhost:$port"; then
        echo "  Verified: the $service process holds the key (/api/auth/verify $HIKER_ADMIN_PROBE_CODE)"
        return 0
    fi

    if [ "$HIKER_ADMIN_PROBE_CODE" = "403" ]; then
        echo "  ERROR: $service is running WITHOUT the key even though this shell read it."
        echo "  systemd loads it as $user, not as root. Check:"
        echo "    systemctl show $service -p EnvironmentFiles --value"
        echo "    sudo -u $user cat $secret_file >/dev/null && echo readable"
        return 1
    fi

    echo "  WARNING: could not reach /api/auth/verify on port $port (HTTP $HIKER_ADMIN_PROBE_CODE)."
    return 1
}

# Does this PID belong to this instance? Matching the CMDLINE STRING was wrong in both
# directions: an orphan started with `cd <dir> && npm start` runs as `node dist/index.js`
# with no path in it at all, while a second checkout can carry a path that is not this
# one. Ask the kernel what the process's working directory actually is, then its exe,
# and fall back to the cmdline.
hiker_process_in_dir() {
    local pid="${1:-}"
    local dir="${2:-}"
    local cwd exe cmd

    [ -n "$pid" ] && [ -n "$dir" ] || return 1
    [ -e "/proc/$pid" ] || return 1

    # cwd/exe of another user's process is restricted, so read them as root.
    cwd=$(hiker_run_as_root readlink "/proc/$pid/cwd" 2>/dev/null || true)
    exe=$(hiker_run_as_root readlink "/proc/$pid/exe" 2>/dev/null || true)
    cmd=$(hiker_run_as_root cat "/proc/$pid/cmdline" 2>/dev/null | tr '\0' ' ' || true)

    case "$cwd" in "$dir"|"$dir"/*) return 0 ;; esac
    case "$exe" in "$dir"/*) return 0 ;; esac
    case "$cmd" in *"$dir"*) return 0 ;; esac

    return 1
}

# Which systemd unit owns a PID, or nothing. A hand-started process reports its login
# session's unit instead, which is still the answer you want: it says the squatter is
# NOT a service, so stopping services will never free the port.
hiker_process_unit() {
    local pid="${1:-}"

    [ -n "$pid" ] || return 1
    [ -e "/proc/$pid/cgroup" ] || return 1

    sed -n 's#.*/\([^.[:space:]]*\.service\).*#\1#p' "/proc/$pid/cgroup" 2>/dev/null | head -1
}
