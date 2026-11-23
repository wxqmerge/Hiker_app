#!/bin/bash
# Move orphaned GPX files to <instance-dir>/orphan/
#
# An "orphaned" GPX file is a .gpx file in exported_data/gpx/ that is not
# referenced by any trail's gpxFile field in exported_data/trails.json.
# This mirrors the server's own orphan detection (see index.ts /api/validate).
#
# Usage:
#   ./orphan_gpx.sh          # process the current instance directory
#   ./orphan_gpx.sh -all     # process every instance under the base directory
#
# Orphaned files are moved to <instance-dir>/orphan/ (inside the instance,
# which is writable by the deploy user — the base dir may not be).
# On a filename collision the file is prefixed with the instance name.

# Self-fix: restore execute permission if stripped by Windows
SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
if [ ! -x "$SCRIPT_PATH" ]; then
    chmod +x "$SCRIPT_PATH" 2>/dev/null || sudo chmod +x "$SCRIPT_PATH"
fi

# Parse flags
ALL=false
for arg in "$@"; do
    case $arg in
        -all)
            ALL=true
            ;;
        -h|--help)
            echo "Usage: $0 [-all]"
            echo "  (no flag)  process the current instance directory"
            echo "  -all       process every instance under the base directory"
            exit 0
            ;;
        *)
            echo "Unknown flag: $arg"
            echo "Usage: $0 [-all]"
            exit 1
            ;;
    esac
done

# Process a single instance directory
process_instance() {
    local dir="$1"
    local name
    name=$(basename "$dir")
    # Respect the instance's DATA_DIR (.env at instance root is the runtime
    # source of truth; travel uses travel_data).
    local data_dir_name
    data_dir_name=$(grep -E '^\s*DATA_DIR=' "$dir/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r')
    data_dir_name="${data_dir_name:-exported_data}"
    local gpx_dir="$dir/$data_dir_name/gpx"
    local trails_file="$dir/$data_dir_name/trails.json"
    local index_file="$dir/$data_dir_name/gpx_index.json"
    local orphan_dir
    orphan_dir="$dir/orphan"

    if [ ! -d "$gpx_dir" ]; then
        echo "[$name] no $data_dir_name/gpx dir — skipping"
        return
    fi
    if [ ! -f "$trails_file" ]; then
        echo "[$name] no $data_dir_name/trails.json — skipping"
        return
    fi

    # Collect referenced gpx filenames: the server serves what gpx_index.json
    # maps, while trails.json mirrors it — treat the UNION as referenced so a
    # transient disagreement can never cause a live file to be moved.
    local ref_file
    ref_file=$(mktemp)
    if ! python3 -c "
import json
refs = set()
d = json.load(open('$trails_file'))
for t in d.get('trails', []):
    g = t.get('gpxFile')
    if g:
        refs.add(g)
try:
    for tid, g in json.load(open('$index_file')).items():
        if g:
            refs.add(g)
except FileNotFoundError:
    pass
print('\n'.join(sorted(refs)))
" > "$ref_file"; then
        echo "[$name] ERROR: failed to parse $trails_file — skipping"
        rm -f "$ref_file"
        return
    fi

    mkdir -p "$orphan_dir"

    local moved=0 kept=0 fname target
    for gpx_file in "$gpx_dir"/*.gpx; do
        [ -f "$gpx_file" ] || continue
        fname=$(basename "$gpx_file")
        if grep -qxF "$fname" "$ref_file"; then
            kept=$((kept + 1))
        else
            target="$orphan_dir/$fname"
            if [ -e "$target" ]; then
                target="$orphan_dir/${name}_${fname}"
            fi
            if mv "$gpx_file" "$target"; then
                echo "  moved: $fname -> $(basename "$target")"
                moved=$((moved + 1))
            else
                echo "  ERROR: failed to move $fname"
            fi
        fi
    done

    rm -f "$ref_file"
    echo "[$name] moved $moved orphaned, kept $kept referenced (orphan dir: $orphan_dir)"
}

if [ "$ALL" = true ]; then
    DIR="$(pwd)"
    BASE="$(dirname "$DIR")"
    echo "Processing all instances under $BASE"
    echo ""
    found=0
    for dir in "$BASE"/*/; do
        [ -d "$dir" ] || continue
        found=$((found + 1))
        process_instance "${dir%/}"
    done
    if [ "$found" -eq 0 ]; then
        echo "No instance directories found under $BASE"
        exit 1
    fi
else
    DIR="$(pwd)"
    if [ ! -f "$DIR/exported_data/trails.json" ]; then
        echo "ERROR: run this from within a hiker instance directory (one containing exported_data/trails.json)."
        echo "Current dir: $DIR"
        exit 1
    fi
    process_instance "$DIR"
fi
