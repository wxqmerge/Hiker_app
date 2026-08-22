import json
from pathlib import Path

data = json.loads(Path('D:/hiker/exported_data/trails.json').read_text())
trails = [t for t in data['trails'] if t.get('duration')]
print(f'Trails with duration: {len(trails)}')
for t in trails[:10]:
    print(f"{t['id']:20s} {t['duration']:10s} {t['distance']} mi")
