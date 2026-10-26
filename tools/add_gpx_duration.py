#!/usr/bin/env python3
"""
Add hike duration to trails.json by parsing GPX files.
Duration is calculated from first to last timestamp in track points.
"""

import json
import re
from pathlib import Path
from datetime import datetime

def extract_duration_from_gpx(gpx_path):
    """Extract duration from GPX file in minutes"""
    try:
        content = Path(gpx_path).read_text(encoding='utf-8', errors='ignore')
        
        # Find all time elements in trkpt
        time_pattern = r'<trkpt[^>]*>.*?<time>([^<]+)</time>'
        times = re.findall(time_pattern, content, re.DOTALL)
        
        if not times:
            # Try without requiring closing tag on same line
            time_pattern_alt = r'<trkpt[^>]*>[\s\S]*?<time>([^<]+)</time>'
            times = re.findall(time_pattern_alt, content, re.DOTALL)
        
        if len(times) < 2:
            return None
        
        try:
            first_time = datetime.fromisoformat(times[0].replace('Z', '+00:00'))
            last_time = datetime.fromisoformat(times[-1].replace('Z', '+00:00'))
            duration = last_time - first_time
            minutes = int(duration.total_seconds() / 60)
            return minutes
        except Exception as e:
            return None
    except Exception:
        return None

def format_duration(minutes):
    """Format minutes as 'Xh Ym' or 'Ym'"""
    if minutes is None:
        return None
    hours = minutes // 60
    mins = minutes % 60
    if hours > 0:
        return f"{hours}h {mins}m" if mins > 0 else f"{hours}h"
    else:
        return f"{mins}m"

# Load trails
trails_file = Path('D:/hiker/exported_data/trails.json')
data = json.loads(trails_file.read_text(encoding='utf-8'))
trails = data['trails']

# GPX directories
gpx_dirs = [
    Path('D:/hiker/GPX'),
    Path('D:/hiker/exported_data/gpx')
]

print(f"Processing {len(trails)} trails...")
updated = 0
failed = 0
skipped = 0

for trail in trails:
    if not trail.get('hasGpx'):
        skipped += 1
        continue
    
    gpx_file = trail.get('gpxFile')
    if not gpx_file:
        skipped += 1
        continue
    
    # Find GPX file
    gpx_path = None
    for gpx_dir in gpx_dirs:
        candidate = gpx_dir / gpx_file
        if candidate.exists():
            gpx_path = candidate
            break
    
    if not gpx_path:
        failed += 1
        continue
    
    # Extract duration
    minutes = extract_duration_from_gpx(gpx_path)
    if minutes:
        trail['durationMinutes'] = minutes
        trail['duration'] = format_duration(minutes)
        updated += 1
    else:
        failed += 1

# Save updated trails
data['trails'] = trails
trails_file.write_text(json.dumps(data, indent=2), encoding='utf-8')

print(f"Done!")
print(f"  Updated with duration: {updated}")
print(f"  Skipped (no GPX): {skipped}")
print(f"  Failed to extract: {failed}")
print(f"\nSample durations:")
for t in trails:
    if t.get('duration'):
        print(f"  {t['id']}: {t['duration']} ({t['distance']} mi)")
        if updated >= 5:
            break
