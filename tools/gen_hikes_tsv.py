import pandas as pd
import json
import numpy as np
import sys
import re
import unicodedata

sys.stdout.reconfigure(encoding='utf-8')

with open(r'D:\hiker\exported_data\trails.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

trails = data['trails']

# Load blocklist
blocklist = set()
try:
    with open(r'D:\hiker\not_altnames.tsv', 'r', encoding='utf-8') as f:
        for line in f:
            blocklist.add(line.strip())
except:
    pass

def normalize(s):
    s = s.lower().strip()
    s = s.replace('\u25c6\ufe0e', '')
    s = s.replace('\u260e', '')
    s = s.replace('*', '')
    s = s.replace('/', ' ')
    s = re.sub(r'\s+', ' ', s)
    s = re.sub(r'\s*\(early start\)\s*', '', s, flags=re.IGNORECASE)
    return s.strip()

def match_score(a, b):
    a = normalize(a)
    b = normalize(b)
    if a == b:
        return 100
    words_a = set(a.split())
    words_b = set(b.split())
    common = words_a & words_b
    if not common:
        return 0
    score = len(common) * 10
    if len(words_a) <= len(words_b) + 1 and words_a.issubset(words_b):
        score += 5
    elif len(words_b) <= len(words_a) + 1 and words_b.issubset(words_a):
        score += 5
    return score

trail_names = []
for t in trails:
    names = [t.get('fullName', ''), t.get('name', '')]
    for alt in t.get('altNames', []):
        names.append(alt)
    trail_names.append((t, names))

def find_match(hike_name):
    best_score = 0
    best_trail = None
    for t, names in trail_names:
        for name in names:
            if not name:
                continue
            sc = match_score(hike_name, name)
            if sc > best_score:
                best_score = sc
                best_trail = t
    return best_trail, best_score

# Read schedule
xls = pd.ExcelFile(r'D:\hiker\SOTHH schedule.xls')
df = pd.read_excel(xls, sheet_name='3Q26 Hikes', header=None)

MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

output_lines = []
output_lines.append('\t\t3rd Quarter Hikes 2026\t\t\t\t\t\t\t')
output_lines.append('\t\t\t\t\t\t\t\t\t')
output_lines.append('\t\t\t\t\t\t\t\t\t')
output_lines.append('Month\tWed\tHike\tLeader / Shadow\t\tMonth\tFri\tHike\tLeader / Shadow\t')

current_month = None
last_month = None
for idx, row in df.iterrows():
    row = row.fillna('')
    cols = [str(c).strip() for c in row.values]

    # Check for month header
    month_str = cols[0] if len(cols) > 0 else ''
    if month_str in MONTH_NAMES:
        current_month = month_str

    if not current_month:
        continue

    # Wednesday hike
    wed_day = cols[1] if len(cols) > 1 else ''
    wed_hike = cols[2] if len(cols) > 2 else ''
    wed_leader = cols[3] if len(cols) > 3 else ''

    # Friday hike
    fri_month = cols[5] if len(cols) > 5 else ''
    fri_day = cols[6] if len(cols) > 6 else ''
    fri_hike = cols[7] if len(cols) > 7 else ''
    fri_leader = cols[8] if len(cols) > 8 else ''

    if not wed_hike and not fri_hike:
        continue
    if wed_hike in ('Hike', '') and fri_hike in ('Hike', ''):
        continue
    if 'Alternate' in wed_hike or 'Alternate' in fri_hike:
        continue

    def format_hike(hike_name):
        early = ''
        if re.search(r'\(early start\)', hike_name, re.IGNORECASE):
            early = ' (Early Start)'
        trail, score = find_match(hike_name)
        if trail and score > 10:
            name = (trail['fullName'] or trail['name']).strip()
            if trail.get('wilderness'):
                name += '\u25c6\ufe0e'
            return name + early
        else:
            if score <= 10:
                return '*' + hike_name
            return hike_name

    wed_name = format_hike(wed_hike) if wed_hike and wed_hike != 'Hike' else ''
    fri_name = format_hike(fri_hike) if fri_hike and fri_hike != 'Hike' else ''

    if wed_name or fri_name:
        wed_month = current_month if current_month != last_month else ''
        fri_month = current_month if current_month != last_month else ''
        last_month = current_month
        line = f'{wed_month}\t{wed_day}\t{wed_name}\t{wed_leader}\t\t{fri_month}\t{fri_day}\t{fri_name}\t{fri_leader}\t'
        output_lines.append(line)

with open(r'D:\hiker\3Q26_hikes.tsv', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output_lines))

print('Written 3Q26_hikes.tsv')
