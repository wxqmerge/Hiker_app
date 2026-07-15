#!/bin/bash
# Compare trail data across all hiker app instances
# Run from any hiker app directory on the server

BASE="/var/www/html"
FOUND=0

echo "Hiker Trail Comparison"
echo "========================================"
printf "%-20s %8s %8s %8s\n" "Instance" "Trails" "GPX" "Links"
printf "%-20s %8s %8s %8s\n" "--------------------" "--------" "--------" "--------"

for dir in "$BASE"/*/; do
    [ -d "$dir" ] || continue
    trails_file="$dir/exported_data/trails.json"
    [ -f "$trails_file" ] || continue

    name=$(basename "$dir")
    FOUND=$((FOUND + 1))
    python3 -c "
import json, sys
name = '$name'
trails_file = '$trails_file'
try:
    d = json.load(open(trails_file))
    trails = d.get('trails', [])
    gpx = sum(1 for t in trails if t.get('gpxFile'))
    links = sum(1 for t in trails if t.get('webLink'))
    print(f'{name:<20} {len(trails):>8} {gpx:>8} {links:>8}')
except Exception as e:
    print(f'{name:<20} ERROR: {e}', file=sys.stderr)
"
done

if [ "$FOUND" -eq 0 ]; then
    echo ""
    echo "No instances found with exported_data/trails.json under $BASE"
    echo "Directories found:"
    ls "$BASE"/ 2>/dev/null
fi
