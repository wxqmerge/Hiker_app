"""
Import schedule from an .xls file and output matched schedule as JSON.
Reads trail data from exported_data/trails.json for matching.
"""
import json
import re
import sys
from pathlib import Path

import pandas as pd

VALID_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
MONTH_FULL = {'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April', 'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August', 'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'}

SKIP_PATTERNS = [
    'alternate wednesday', 'alternate friday', 'alternate hike', 'alternate wed',
    'canceled', 'cancel', 'tbd', 'tba', 'wilderness 12max', 'note:', 'firm dates'
]


def safe_str(val):
    if val is None or pd.isna(val):
        return ''
    return str(val).strip()


def is_valid_hike_name(hike_name):
    if not hike_name:
        return False
    lower = hike_name.lower()
    for pat in SKIP_PATTERNS:
        if pat == 'early start' and 'early start' in lower:
            if lower == 'early start':
                return False
            continue
        if pat in lower:
            return False
    alpha = re.sub(r'[^a-zA-Z]', '', hike_name)
    return len(alpha) >= 3


def normalize(text):
    return re.sub(r'[^a-z0-9\s]', ' ', str(text).lower()).replace('  ', ' ').strip()


def match_hike(hike_name, trails):
    hike_norm = normalize(hike_name)
    hike_words = [w for w in hike_norm.split() if len(w) > 1]

    common_parts = ['gray', 'wolf', 'creek', 'cree', 'river', 'lake', 'peak',
                    'hill', 'mount', 'mt', 'road', 'rd', 'trail', 'tr', 'valley',
                    'pass', 'ridge', 'spit', 'beach', 'park', 'dam', 'fall']
    merged_words = []
    for word in hike_words:
        for part in common_parts:
            if part in word and len(word) > len(part) + 2:
                idx = word.index(part)
                before = word[:idx]
                after = word[idx:]
                if idx == 0:
                    remaining = after[len(part):]
                    if remaining and len(remaining) > 2 and remaining not in merged_words:
                        merged_words.append(remaining)
                    if len(part) > 2 and part not in merged_words:
                        merged_words.append(part)
                else:
                    if len(before) > 2 and before not in merged_words:
                        merged_words.append(before)
                    if len(after) > 2 and after not in merged_words:
                        merged_words.append(after)
                break

    extra = [w for w in merged_words if w not in hike_words]
    all_words = list(set(hike_words + extra))
    if not all_words:
        return None

    best_match = None
    best_score = 0

    for t in trails:
        full_norm = normalize(t.get('fullName', ''))
        name_norm = normalize(t.get('name', ''))
        all_text = f"{full_norm} {name_norm}"

        score = 0
        words_matched = 0
        for word in all_words:
            if word in all_text:
                score += len(word)
                words_matched += 1
        if words_matched == len(all_words) and len(all_words) > 2:
            score += 10
        if hike_norm in all_text:
            score += 20
        for word in all_words:
            if len(word) > 3 and word in t.get('name', '').lower():
                score += 5

        if score > best_score:
            best_score = score
            best_match = t['id']

    return {'id': best_match, 'score': best_score} if best_score >= 4 and best_match else None


def parse_xls(xls_path, trails_path):
    # Load trails for matching
    with open(trails_path, 'r', encoding='utf-8') as f:
        trails = json.load(f).get('trails', [])

    # Read Excel
    xls_file = pd.ExcelFile(xls_path)
    sheet = xls_file.sheet_names[0]
    df = pd.read_excel(xls_path, sheet_name=sheet, header=None, keep_default_na=False)

    rows = df.values.tolist()
    if not rows:
        return {'error': 'Worksheet is empty'}

    # Find header row with Month, (Wed/Fri/Date), Hike
    header_row = -1
    for i in range(min(5, len(rows))):
        row_strs = [safe_str(c).lower() for c in rows[i]]
        has_date = any(s in ('date', 'wed', 'fri', 'wednesday', 'friday') for s in row_strs)
        if 'month' in row_strs and has_date and 'hike' in row_strs:
            header_row = i
            break

    if header_row < 0:
        sample = ' | '.join([safe_str(c)[:30] for c in rows[0][:6]])
        return {'error': f'Cannot find expected columns (Month, Date/Wed/Fri, Hike). First row: "{sample}"'}

    # Find all Month/(Wed|Fri|Date)/Hike column triplets
    num_cols = len(rows[0])
    header_strs = [safe_str(c).lower() for c in rows[header_row]]
    all_cols = []
    for c in range(num_cols - 1):
        if header_strs[c] == 'month':
            for d in range(c + 1, num_cols):
                if header_strs[d] in ('date', 'wed', 'fri', 'wednesday', 'friday'):
                    for h in range(d + 1, num_cols):
                        if header_strs[h] == 'hike':
                            all_cols.append((c, d, h))
                            break
                    break

    if not all_cols:
        header_sample = ' | '.join([safe_str(c) for c in rows[header_row]])
        return {'error': f'Found header row but cannot locate Month/(Wed|Fri|Date)/Hike columns. Headers: "{header_sample}"'}

    hikes = []
    current_month = ''

    for i in range(header_row + 1, len(rows)):
        for m_col, d_col, h_col in all_cols:
            if m_col >= len(rows[i]) or d_col >= len(rows[i]) or h_col >= len(rows[i]):
                continue
            month_val = safe_str(rows[i][m_col])
            day_val = safe_str(rows[i][d_col])
            hike_val = safe_str(rows[i][h_col])

            if not month_val and not day_val and not hike_val:
                continue

            if month_val in VALID_MONTHS:
                current_month = month_val
            if not hike_val or not current_month:
                continue
            if not is_valid_hike_name(hike_val):
                continue

            try:
                day = int(float(day_val))
            except (ValueError, TypeError):
                continue

            if 0 < day <= 31:
                hikes.append({'month': current_month, 'day': day, 'hike': hike_val})

    # Match hikes to trails
    matched = []
    unmatched = []
    for h in hikes:
        early_start = 'early start' in h['hike'].lower()
        clean_hike = re.sub(r'\s*\(?Early Start\)?\s*', '', h['hike'], flags=re.IGNORECASE).strip()
        m = match_hike(clean_hike, trails)
        if m:
            matched.append({**h, 'hike': clean_hike, 'trail_id': m['id'], 'early_start': early_start})
        else:
            unmatched.append(h)

    # Build schedule by month
    schedule_by_month = {}
    for entry in matched:
        full_month = MONTH_FULL.get(entry['month'], entry['month'])
        if full_month not in schedule_by_month:
            schedule_by_month[full_month] = {}
        schedule_by_month[full_month][str(entry['day'])] = {
            'trail_id': entry['trail_id'],
            'hike': entry['hike'] or None,
            'early_start': entry['early_start']
        }

    return {
        'success': True,
        'schedule': schedule_by_month,
        'matched': len(matched),
        'unmatched': len(unmatched),
        'unmatchedDetails': unmatched[:20],
        'months': list(schedule_by_month.keys()),
    }


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(json.dumps({'error': 'Usage: python import_schedule_xls.py <xls_file> <trails_json>'}))
        sys.exit(1)

    xls_path = sys.argv[1]
    trails_path = sys.argv[2]

    result = parse_xls(xls_path, trails_path)
    print(json.dumps(result))
