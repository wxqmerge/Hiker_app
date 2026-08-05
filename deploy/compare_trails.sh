#!/bin/bash
# Compare trail data across all hiker app instances
# Run from any hiker app directory on the server

BASE="/var/www/html"
FOUND=0

echo "Hiker Instance Comparison"
echo "========================================"
echo ""

# 1. Trail data
echo "--- Trails ---"
printf "%-20s %8s %8s %8s %8s %8s\n" "Instance" "Trails" "GPX" "Links" "Tides" "Details"
printf "%-20s %8s %8s %8s %8s %8s\n" "--------------------" "--------" "--------" "--------" "--------" "--------"

for dir in "$BASE"/*/; do
    [ -d "$dir" ] || continue
    trails_file="$dir/exported_data/trails.json"
    [ -f "$trails_file" ] || continue

    name=$(basename "$dir")
    FOUND=$((FOUND + 1))
    details_file="$dir/exported_data/trail_details.json"
    python3 -c "
import json, sys
name = '$name'
trails_file = '$trails_file'
details_file = '$details_file'
try:
    d = json.load(open(trails_file))
    trails = d.get('trails', [])
    gpx = sum(1 for t in trails if t.get('gpxFile'))
    links = sum(1 for t in trails if t.get('webLink'))
    tides = sum(1 for t in trails if t.get('tideStationId'))
    details = 0
    try:
        dd = json.load(open(details_file))
        trail_ids = {t['id'] for t in trails}
        details = sum(1 for tid in dd if tid in trail_ids)
    except:
        pass
    print(f'{name:<20} {len(trails):>8} {gpx:>8} {links:>8} {tides:>8} {details:>8}')
except Exception as e:
    print(f'{name:<20} ERROR: {e}', file=sys.stderr)
"
done

echo ""
echo "--- Schedules ---"
printf "%-20s %12s %10s %8s %8s\n" "Instance" "Group" "Entries" "Months" "Slots"
printf "%-20s %12s %10s %8s %8s\n" "--------------------" "------------" "----------" "--------" "--------"

for dir in "$BASE"/*/; do
    [ -d "$dir" ] || continue
    env_file="$dir/server/.env"
    [ -f "$env_file" ] || continue

    name=$(basename "$dir")
    SCHED_NAME=$(grep '^SCHEDULE_NAME=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]')
    [ -z "$SCHED_NAME" ] && SCHED_NAME="default"
    sched_file="$dir/exported_data/schedule_${SCHED_NAME}.json"
    [ -f "$sched_file" ] || continue

    python3 -c "
import json, sys
name = '$name'
group = '$SCHED_NAME'
sched_file = '$sched_file'
try:
    d = json.load(open(sched_file))
    months = len(d)
    entries = sum(len(v) for v in d.values() if isinstance(v, list))
    slots = set()
    for v in d.values():
        if isinstance(v, list):
            for e in v:
                if isinstance(e, dict):
                    slots.add(e.get('slot', 0))
    slot_str = ','.join(str(s) for s in sorted(slots))
    print(f'{name:<20} {group:>12} {entries:>10} {months:>8} {slot_str:>8}')
except Exception as e:
    print(f'{name:<20} ERROR: {e}', file=sys.stderr)
"
done

echo ""
echo "--- Environment ---"
printf "%-20s %12s %10s %12s %8s %8s\n" "Instance" "Group" "HikeDays" "NodeEnv" "Port" "API Key"
printf "%-20s %12s %10s %12s %8s %8s\n" "--------------------" "------------" "----------" "------------" "--------" "--------"

for dir in "$BASE"/*/; do
    [ -d "$dir" ] || continue
    env_file="$dir/server/.env"
    [ -f "$env_file" ] || continue

    name=$(basename "$dir")
    SCHED_NAME=$(grep '^SCHEDULE_NAME=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]')
    HIKE_DAYS=$(grep '^HIKE_DAYS=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]')
    NODE_ENV_VAL=$(grep '^NODE_ENV=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]')
    PORT_VAL=$(grep '^PORT=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]')
    API_KEY=$(grep '^ADMIN_API_KEY=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]')

    [ -z "$SCHED_NAME" ] && SCHED_NAME="-"
    [ -z "$HIKE_DAYS" ] && HIKE_DAYS="-"
    [ -z "$NODE_ENV_VAL" ] && NODE_ENV_VAL="-"
    [ -z "$PORT_VAL" ] && PORT_VAL="-"
    [ -n "$API_KEY" ] && API_KEY="set" || API_KEY="none"

    printf "%-20s %12s %10s %12s %8s %8s\n" "$name" "$SCHED_NAME" "$HIKE_DAYS" "$NODE_ENV_VAL" "$PORT_VAL" "$API_KEY"
done

echo ""
echo "--- Build Status ---"
printf "%-20s %8s %8s %8s\n" "Instance" "Dist" "Server" "Git HEAD"
printf "%-20s %8s %8s %8s\n" "--------------------" "--------" "--------" "--------"

for dir in "$BASE"/*/; do
    [ -d "$dir" ] || continue
    name=$(basename "$dir")

    dist_count=$(find "$dir/dist" -type f 2>/dev/null | wc -l)
    server_dist=$(ls "$dir/server/dist/index.js" 2>/dev/null && echo "yes" || echo "no")
    git_head=$(cd "$dir" 2>/dev/null && git log --oneline -1 2>/dev/null | cut -c1-7 || echo "?")

    [ "$dist_count" -eq 0 ] 2>/dev/null && dist_count="missing"
    printf "%-20s %8s %8s %8s\n" "$name" "$dist_count" "$server_dist" "$git_head"
done

echo ""
echo "--- Service Status ---"
printf "%-20s %12s %8s\n" "Instance" "State" "Uptime"
printf "%-20s %12s %8s\n" "--------------------" "------------" "--------"

for dir in "$BASE"/*/; do
    [ -d "$dir" ] || continue
    name=$(basename "$dir")
    state=$(systemctl show -p ActiveState --value "$name" 2>/dev/null || echo "unknown")
    uptime=$(systemctl show -p ActiveEnterTimestamp --value "$name" 2>/dev/null || echo "-")
    printf "%-20s %12s %8s\n" "$name" "$state" "$uptime"
done

if [ "$FOUND" -eq 0 ]; then
    echo ""
    echo "No instances found with exported_data/trails.json under $BASE"
    echo "Directories found:"
    ls "$BASE"/ 2>/dev/null
fi
