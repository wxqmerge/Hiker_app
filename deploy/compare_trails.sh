#!/bin/bash
# Compare trail data across all hiker app instances
# Run from any hiker app directory on the server

BASE="/var/www/html"

echo "Hiker Trail Comparison"
echo "========================================"
printf "%-20s %8s %8s %8s\n" "Instance" "Trails" "GPX" "Links"
printf "%-20s %8s %8s %8s\n" "--------------------" "--------" "--------" "--------"

for dir in "$BASE"/*/; do
    [ -d "$dir" ] || continue
    trails_file="$dir/exported_data/trails.json"
    [ -f "$trails_file" ] || continue

    name=$(basename "$dir")
    python3 -c "
import json
d = json.load(open('$trails_file'))
trails = d.get('trails', [])
gpx = sum(1 for t in trails if t.get('gpxFile'))
links = sum(1 for t in trails if t.get('webLink'))
print(f'{name:<20} {len(trails):>8} {gpx:>8} {links:>8}')
" 2>/dev/null
done
