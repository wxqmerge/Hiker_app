import pandas as pd
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

xls = pd.ExcelFile(r'D:\hiker\Hike Data BaseM.xls')

excel_data = {}
for sheet_name in xls.sheet_names:
    if sheet_name in ('Instructions', 'Report', 'Index'):
        continue
    df = pd.read_excel(xls, sheet_name=sheet_name, header=None)
    name = str(df.iloc[0, 0]).strip() if pd.notna(df.iloc[0, 0]) else sheet_name
    n = len(df.columns)
    distance = df.iloc[2, 1] if n > 1 and pd.notna(df.iloc[2, 1]) else None
    dist_ext = df.iloc[2, 3] if n > 3 and pd.notna(df.iloc[2, 3]) else None
    elev_start = df.iloc[2, 6] if n > 6 and pd.notna(df.iloc[2, 6]) else None
    elev_max = df.iloc[2, 8] if n > 8 and pd.notna(df.iloc[2, 8]) else None
    difficulty = df.iloc[4, 1] if n > 1 and pd.notna(df.iloc[4, 1]) else None
    parking = df.iloc[3, 1] if n > 1 and pd.notna(df.iloc[3, 1]) else None
    season = df.iloc[3, 6] if n > 6 and pd.notna(df.iloc[3, 6]) else None
    range_val = df.iloc[4, 6] if n > 6 and pd.notna(df.iloc[4, 6]) else None
    excel_data[name] = {
        'sheet': sheet_name,
        'distance': distance,
        'distanceExtended': dist_ext,
        'elevationStart': elev_start,
        'elevationMax': elev_max,
        'difficulty': difficulty,
        'parking': parking,
        'season': season,
        'range': range_val,
    }

with open(r'D:\hiker\exported_data\trails.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

json_trails = {}
for t in data['trails']:
    if t.get('fullName'):
        json_trails[t['fullName'].strip()] = t

def to_num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        v = v.strip().rstrip("'").strip()
        try:
            return float(v)
        except:
            return None
    return None

type_diffs = 0
real_diffs = []
for name, ed in excel_data.items():
    if name not in json_trails:
        continue
    jt = json_trails[name]
    checks = [
        ('distance', ed['distance'], jt.get('distance')),
        ('distanceExtended', ed['distanceExtended'], jt.get('distanceExtended')),
        ('elevationStart', ed['elevationStart'], jt.get('elevationStart')),
        ('elevationMax', ed['elevationMax'], jt.get('elevationMax')),
        ('difficulty', ed['difficulty'], jt.get('difficulty')),
        ('parking', ed['parking'], jt.get('parking')),
        ('range', ed['range'], jt.get('range')),
    ]
    for field, ev, jv in checks:
        if ev is None:
            continue
        # Check if it's a type difference only
        if isinstance(ev, str) and isinstance(jv, (int, float)) and to_num(ev) == jv:
            type_diffs += 1
            continue
        if isinstance(jv, str) and isinstance(ev, (int, float)) and to_num(ev) == float(jv):
            type_diffs += 1
            continue
        # Real value difference
        real_diffs.append((name, field, ev, jv))

print('Type-only differences (value matches, type differs):', type_diffs)
print('Real value differences:', len(real_diffs))
for name, field, ev, jv in real_diffs:
    print('  %s: %s Excel=%r JSON=%r' % (name, field, ev, jv))
