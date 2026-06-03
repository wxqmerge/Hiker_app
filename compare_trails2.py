import pandas as pd
import json
import numpy as np
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
    if isinstance(v, (int, float, np.integer, np.floating)):
        return float(v)
    if isinstance(v, str):
        v = v.strip().rstrip("'").strip().rstrip("'").strip()
        v = v.replace(',', '')
        try:
            return float(v)
        except:
            return None
    return None

def is_numeric(v):
    return v is not None and isinstance(v, (int, float, np.integer, np.floating))

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
        # Both numeric -> compare numerically
        if is_numeric(ev) and is_numeric(jv):
            if abs(to_num(ev) - to_num(jv)) > 0.001:
                real_diffs.append((name, field, ev, jv))
            continue
        # String with numeric content -> compare numerically
        if isinstance(ev, str) and is_numeric(jv):
            en = to_num(ev)
            if en is not None and abs(en - to_num(jv)) > 0.001:
                real_diffs.append((name, field, ev, jv))
            continue
        if isinstance(jv, str) and is_numeric(ev):
            jn = to_num(jv)
            if jn is not None and abs(to_num(ev) - jn) > 0.001:
                real_diffs.append((name, field, ev, jv))
            continue
        # Both strings -> compare directly
        if isinstance(ev, str) and isinstance(jv, str):
            if ev != jv:
                real_diffs.append((name, field, ev, jv))
            continue
        # One numeric, one non-numeric string
        if is_numeric(ev) and isinstance(jv, str):
            # Excel numeric but JSON string (or vice versa)
            jn = to_num(jv)
            if jn is not None:
                if abs(to_num(ev) - jn) <= 0.001:
                    type_diffs += 1
                    continue
            real_diffs.append((name, field, ev, jv))
            continue
        if isinstance(ev, str) and is_numeric(jv):
            en = to_num(ev)
            if en is not None:
                if abs(en - to_num(jv)) <= 0.001:
                    type_diffs += 1
                    continue
            real_diffs.append((name, field, ev, jv))
            continue
        # Different string values (non-numeric)
        if isinstance(ev, str) and not isinstance(jv, str):
            real_diffs.append((name, field, ev, jv))
            continue
        if not isinstance(ev, str) and isinstance(jv, str):
            real_diffs.append((name, field, ev, jv))
            continue

print('Type-only differences (value matches, type differs):', type_diffs)
print('Real value differences:', len(real_diffs))
print()

# Categorize
rounding = []
non_numeric = []
actual = []
for name, field, ev, jv in real_diffs:
    # Check if both can be parsed as numbers (rounding)
    en = to_num(ev)
    jn = to_num(jv)
    if en is not None and jn is not None:
        diff = abs(en - jn)
        if diff > 0 and diff <= 0.2:
            rounding.append((name, field, ev, jv, diff))
        else:
            actual.append((name, field, ev, jv))
    else:
        non_numeric.append((name, field, ev, jv))

print('Rounding differences:', len(rounding))
for name, field, ev, jv, diff in rounding:
    print('  %s: %s Excel=%r JSON=%r (diff=%.4f)' % (name, field, ev, jv, diff))

print()
print('Non-numeric Excel values in JSON:', len(non_numeric))
for name, field, ev, jv in non_numeric:
    print('  %s: %s Excel=%r JSON=%r' % (name, field, ev, jv))

print()
print('Actual value differences:', len(actual))
for name, field, ev, jv in actual:
    print('  %s: %s Excel=%r JSON=%r' % (name, field, ev, jv))
