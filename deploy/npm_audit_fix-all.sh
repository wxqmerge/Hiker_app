#!/bin/bash
# Run safe npm audit remediation for all instances of this repo.
# Detects repo from this script's location, then runs for each instance under $BASE.
#
# Usage:
#   ./deploy/npm_audit_fix-all.sh
#   BASE=/var/www/html bash deploy/npm_audit_fix-all.sh
#
# This script intentionally does NOT run `npm audit fix --force`.
# npm audit fix --force can perform unrelated major upgrades and has triggered
# npm Arborist failures such as: Cannot read properties of null reading 'edgesOut'.

BASE="${BASE:-/var/www/html}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CALLER_REMOTE=$(git -C "$SCRIPT_DIR" remote get-url origin 2>/dev/null)
CALLER_REPO=$(basename "$CALLER_REMOTE" .git)

if [ -z "$CALLER_REPO" ]; then
  echo "Error: could not detect git repo from $SCRIPT_DIR"
  exit 1
fi

echo "========================================"
echo "  Safe npm audit remediation for $CALLER_REPO"
echo "  Base: $BASE"
echo "========================================"
echo ""

OK=0
FAIL=0
SKIP=0
WARN=0

has_package_dep() {
  local pkg_json="$1"
  local dep="$2"

  [ -f "$pkg_json" ] || return 1

  node - "$pkg_json" "$dep" <<'NODE'
const fs = require('fs');
const p = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const dep = process.argv[3];
const found =
  (p.dependencies && p.dependencies[dep]) ||
  (p.devDependencies && p.devDependencies[dep]) ||
  (p.optionalDependencies && p.optionalDependencies[dep]);
process.exit(found ? 0 : 1);
NODE
}

npm_install_deps() {
  local pkg_dir="$1"

  (cd "$pkg_dir" && npm install --no-audit --no-fund) && return 0

  echo "    retrying npm install after clearing npm cache"
  npm cache clean --force >/dev/null 2>&1 || true
  (cd "$pkg_dir" && npm install --no-audit --no-fund)
}

npm_install_pkg() {
  local pkg_dir="$1"
  local pkg="$2"

  (cd "$pkg_dir" && npm install "$pkg" --no-audit --no-fund) && return 0

  echo "    retrying npm install $pkg after clearing npm cache"
  npm cache clean --force >/dev/null 2>&1 || true
  (cd "$pkg_dir" && npm install "$pkg" --no-audit --no-fund)
}

remove_package_dep_if_present() {
  local pkg_dir="$1"
  local dep="$2"
  local label="$3"

  if has_package_dep "$pkg_dir/package.json" "$dep"; then
    echo "  -> removing obsolete $label $dep"
    (cd "$pkg_dir" && npm uninstall "$dep" --no-audit --no-fund) || true
  fi
}

remediate_pkg() {
  local pkg_dir="$1"
  local label="$2"

  if [ ! -f "$pkg_dir/package.json" ]; then
    echo "  -> no $label package.json"
    return 0
  fi

  cd "$pkg_dir" || return 1
  echo "  -> npm install ($label)"
  if ! npm_install_deps "$pkg_dir"; then
    echo "    ✗ $label npm install failed"
    return 1
  fi

  if has_package_dep "$pkg_dir/package.json" "adm-zip"; then
    echo "  -> upgrading $label adm-zip to 0.6.1"
    if ! npm_install_pkg "$pkg_dir" "adm-zip@0.6.1"; then
      echo "    ✗ $label adm-zip upgrade failed"
      echo "      If npm reports 'edgesOut', upgrade npm on this server first:"
      echo "        npm install -g npm@11"
      return 1
    fi
    remove_package_dep_if_present "$pkg_dir" "@types/adm-zip" "$label"
  fi

  return 0
}

report_audit() {
  local pkg_dir="$1"
  local label="$2"

  if [ ! -f "$pkg_dir/package.json" ]; then
    return 2
  fi

  cd "$pkg_dir" || return 1
  echo "  -> npm audit ($label)"
  if npm audit; then
    echo "    ✓ $label audit clean"
    return 0
  else
    echo "    ⚠ $label audit reports remaining advisories"
    return 3
  fi
}

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

  if ! remediate_pkg "$dir" root; then
    echo "  ✗ $name root remediation failed"
    FAIL=$((FAIL + 1))
    echo ""
    continue
  fi

  if ! remediate_pkg "${dir}server" server; then
    echo "  ✗ $name server remediation failed"
    FAIL=$((FAIL + 1))
    echo ""
    continue
  fi

  report_audit "$dir" root
  root_rc=$?
  if [ "$root_rc" -eq 1 ]; then
    FAIL=$((FAIL + 1))
    echo ""
    continue
  elif [ "$root_rc" -eq 3 ]; then
    WARN=$((WARN + 1))
  fi

  report_audit "${dir}server" server
  server_rc=$?
  if [ "$server_rc" -eq 1 ]; then
    FAIL=$((FAIL + 1))
    echo ""
    continue
  elif [ "$server_rc" -eq 3 ]; then
    WARN=$((WARN + 1))
  fi

  if [ "$root_rc" -eq 0 ] && [ "$server_rc" -eq 0 ]; then
    OK=$((OK + 1))
    echo "  ✓ $name completed"
  else
    OK=$((OK + 1))
    echo "  ✓ $name completed with audit warnings"
  fi
  echo ""
done

echo "========================================"
echo "  Done: $OK OK, $FAIL failed, $WARN audit-warning groups, $SKIP skipped"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
