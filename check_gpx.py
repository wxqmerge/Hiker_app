import json
from pathlib import Path

trails_file = Path('D:/hiker/exported_data/trails.json')
data = json.loads(trails_file.read_text())
trails = data['trails']

with_gpx = [t for t in trails if t.get('hasGpx')]
print(f'Total trails: {len(trails)}')
print(f'Trails with GPX: {len(with_gpx)}')

gpx_dir = Path('D:/hiker/GPX')
for t in with_gpx[:10]:
    gpx_file = gpx_dir / t['gpxFile']
    print(f"{t['id']}: {t['gpxFile']} exists={gpx_file.exists()}")
