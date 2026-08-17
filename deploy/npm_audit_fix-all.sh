#!/bin/bash
# Run npm audit fix --force for all instances of this repo
# Detects repo from this script's location, then runs for each instance under /var/www/html
# Usage: ./deploy/npm_audit_fix-all.sh

BASE="/var/www/html"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CALLER_REMOTE=$(git -C "$SCRIPT_DIR" remote get-url origin 2>/dev/null)
CALLER_REPO=$(basename "$CALLER_REMOTE" .git)

if [ -z "$CALLER_REPO" ]; then
  echo "Error: could not detect git repo from $SCRIPT_DIR"
  exit 1
fi

echo "========================================"
echo "  npm audit fix --force for $CALLER_REPO"
echo "  Base: $BASE"
echo "========================================"
echo ""

OK=0
FAIL=0
SKIP=0

for dir in "$BASE"/*/; do
  [ -d "$dir" ] || continue
  name=$(basename "$dir")

  if ! git -C "$dir" remote -v &>/dev/null; then
    echo "  ⊘ $name — not a git repo, skipping"
    SKIP=$((SKIP + 1))
    echo ""
    continue
  fi

  remote=$(git -C "$dir" remote get-url origin 2>/dev/null)
  repo=$(basename "$remote" .git)

  if [ "$repo" != "$CALLER_REPO" ]; then
    echo "  ⊘ $name — different repo ($repo), skipping"
    SKIP=$((SKIP + 1))
    echo ""
    continue
  fi

  echo "========================================"
  echo "  Processing: $name"
  echo "========================================"

  cd "$dir" || continue

  # Root
  if [ -f "package.json" ]; then
    echo "  → npm audit fix --force (root)"
    if npm audit fix --force; then
      echo "    ✓ root fixed"
    else
      echo "    ✗ root failed"
      FAIL=$((FAIL + 1))
      continue
    fi
  else
    echo "  → no root package.json"
  fi

  # Server
  if [ -f "server/package.json" ]; then
    echo "  → npm audit fix --force (server)"
    if (cd server && npm audit fix --force); then
      echo "    ✓ server fixed"
    else
      echo "    ✗ server failed"
      FAIL=$((FAIL + 1))
      continue
    fi
  else
    echo "  → no server/package.json"
  fi

  echo "  ✓ $name completed"
  OK=$((OK + 1))
  echo ""
done

echo "========================================"
echo "  Done: $OK OK, $FAIL failed, $SKIP skipped"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
