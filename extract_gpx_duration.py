#!/usr/bin/env python3
"""
Extract hike duration from GPX file by parsing timestamps from trkpt elements.
GPX files contain <time>ISO8601</time> in each track point.
Duration = last_time - first_time
"""

import re
import sys
from datetime import datetime
from pathlib import Path

def extract_duration_from_gpx(gpx_path):
    """Extract duration from GPX file in hours:minutes format"""
    content = Path(gpx_path).read_text(encoding='utf-8', errors='ignore')
    
    # Find all time elements in trkpt elements
    # Pattern matches <trkpt ...><time>...</time></trkpt>
    time_pattern = r'<trkpt[^>]*>.*?<time>([^<]+)</time>'
    times = re.findall(time_pattern, content, re.DOTALL)
    
    if not times:
        # Try alternative pattern for wpt/rtept
        time_pattern_alt = r'<trkpt[^>]*>.*?(\s+<time>([^<]+)</time>)'
        times = re.findall(time_pattern_alt, content, re.DOTALL)
        if times:
            times = [t[1] for t in times]
    
    if not times:
        return None, "No timestamps found"
    
    try:
        # Parse first and last time
        first_time = datetime.fromisoformat(times[0].replace('Z', '+00:00'))
        last_time = datetime.fromisoformat(times[-1].replace('Z', '+00:00'))
        duration = last_time - first_time
        
        hours = duration.total_seconds() / 3600
        hours_int = int(hours)
        minutes = int((hours - hours_int) * 60)
        
        if hours_int > 0:
            return f"{hours_int}h {minutes}m", f"{hours:.1f} hours"
        else:
            return f"{minutes}m", f"{minutes} minutes"
    except Exception as e:
        return None, f"Error parsing times: {e}"

# Test on a sample GPX file
if __name__ == '__main__':
    gpx_file = Path('D:/hiker/GPX/Anderson_Lake_State_Park.gpx')
    if gpx_file.exists():
        duration, details = extract_duration_from_gpx(gpx_file)
        print(f"File: {gpx_file.name}")
        print(f"Duration: {duration}")
        print(f"Details: {details}")
    else:
        print(f"File not found: {gpx_file}")
        # Try first GPX file in directory
        gpx_dir = Path('D:/hiker/GPX')
        if gpx_dir.exists():
            files = list(gpx_dir.glob('*.gpx'))[:3]
            for f in files:
                print(f"\n--- {f.name} ---")
                dur, det = extract_duration_from_gpx(f)
                print(f"Duration: {dur} ({det})")
