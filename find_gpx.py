import json
from pathlib import Path

trails_file = Path('D:/hiker/exported_data/trails.json')
data = json.loads(trails_file.read_text())
trails = data['trails']

with_gpx = [t for t in trails if t.get('hasGpx')]
print(f'Trails with GPX: {len(with_gpx)}')

gpx_dirs = [
    Path('D:/hiker/GPX'),
    Path('D:/hiker/exported_data/gpx')
]

missing = []
found = []
for t in with_gpx:
    found_file = False
    for gpx_dir in gpx_dirs:
        if (gpx_dir / t['gpxFile']).exists():
            found.append(t['id'])
            found_file = True
            break
    if not found_file:
        missing.append((t['id'], t['gpxFile']))

print(f'Found GPX files: {len(found)}')
print(f'Missing GPX files: {len(missing)}')
if missing:
    print('Missing:')
    for id, file in missing[:10]:
        print(f'  {id}: {file}')
