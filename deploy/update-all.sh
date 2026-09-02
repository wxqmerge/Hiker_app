#!/bin/bash
# Update all app instances on the server
# Run from: /var/www/html/
# Usage: ./deploy/update-all.sh [--force|--force-critical] [--audit] [--env dev|app]
#
# Detects each instance by git remote origin, then runs its
# deploy/update.sh with any flags passed through.
# --audit also runs npm_audit_fix-all.sh after all updates.
# --env dev|app  only update instances whose directory name contains the given tag
# Works for any project that has a git repo and deploy/update.sh.

BASE="/var/www/html"
RUN_AUDIT=false
ENV_TAG=""
FLAGS=""

# Parse flags: --audit, --env dev|app
ARG_IDX=1
while [ $ARG_IDX -le $# ]; do
    case "${!ARG_IDX}" in
        --audit)
            RUN_AUDIT=true
            ;;
        --env)
            ARG_IDX=$((ARG_IDX + 1))
            ENV_TAG="${!ARG_IDX}"
            if [ -z "$ENV_TAG" ] || [ "$ENV_TAG" != "dev" ] && [ "$ENV_TAG" != "app" ]; then
                echo "Error: --env requires 'dev' or 'app' argument"
                exit 1
            fi
            ;;
        *)
            FLAGS="$FLAGS ${!ARG_IDX}"
            ;;
    esac
    ARG_IDX=$((ARG_IDX + 1))
done
OK=0
FAIL=0
SKIP=0

# Detect the project repo from the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CALLER_REMOTE=$(git -C "$SCRIPT_DIR" remote get-url origin 2>/dev/null)
CALLER_REPO=$(basename "$CALLER_REMOTE" .git)

if [ -z "$CALLER_REPO" ]; then
    echo "Error: could not detect git repo from $SCRIPT_DIR"
    echo "This script must be run from within a project directory."
    exit 1
fi

echo "========================================"
echo "  Update ALL $CALLER_REPO Instances"
echo "  Base: $BASE"
echo "  Flags: ${FLAGS:-none}"
echo "========================================"
echo ""

for dir in "$BASE"/*/; do
    [ -d "$dir" ] || continue
    name=$(basename "$dir")

    # Must be a git repository
    if ! git -C "$dir" remote -v &>/dev/null; then
        echo "  ⊘ $name — not a git repo, skipping"
        SKIP=$((SKIP + 1))
        echo ""
        continue
    fi

    # Detect repo from remote origin — must match calling project
    remote=$(git -C "$dir" remote get-url origin 2>/dev/null)
    repo=$(basename "$remote" .git)

    if [ "$repo" != "$CALLER_REPO" ]; then
        echo "  ⊘ $name — different repo ($repo), skipping"
        SKIP=$((SKIP + 1))
        echo ""
        continue
    fi

    # Optional filter: only update instances whose directory name contains ENV_TAG
    if [ -n "$ENV_TAG" ]; then
        lower_name=$(echo "$name" | tr '[:upper:]' '[:lower:]')
        if [[ ! "$lower_name" == *"$ENV_TAG"* ]]; then
            echo "  ⊘ $name — does not contain '$ENV_TAG', skipping"
            SKIP=$((SKIP + 1))
            echo ""
            continue
        fi
    fi

    # Must have deploy/update.sh
    if [ ! -f "$dir/deploy/update.sh" ]; then
        echo "  ⊘ $name — no deploy/update.sh, skipping"
        SKIP=$((SKIP + 1))
        echo ""
        continue
    fi

    echo "========================================"
    echo "  Updating: $name  (repo: $repo)"
    echo "========================================"

    cd "$dir" 2>/dev/null || continue
    if bash deploy/update.sh $FLAGS; then
        echo ""
        echo "  ✓ $name updated successfully"
        OK=$((OK + 1))
    else
        echo ""
        echo "  ✗ $name FAILED"
        FAIL=$((FAIL + 1))
    fi
    echo ""
done

echo "========================================"
echo "  Done: $OK OK, $FAIL failed, $SKIP skipped"
echo "========================================"

if [ "$RUN_AUDIT" = true ]; then
    echo ""
    echo "========================================"
    echo "  Running npm audit fix --force"
    echo "========================================"
    bash "$SCRIPT_DIR/npm_audit_fix-all.sh"
fi

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
