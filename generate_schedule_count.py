"""
Generate trail_schedule_count.tsv from SOTHH schedule.xls.

Counts how many times each trail appears across all schedule sheets.
Output: exported_data/trail_schedule_count.tsv
"""

import pandas as pd
import json
import re
import warnings
warnings.filterwarnings('ignore')

def safe_str(val):
    """Safely convert value to ASCII string."""
    if pd.isna(val):
        return ''
    try:
        return str(val).encode('ascii', errors='replace').decode('ascii')
    except:
        return ''

def normalize(text):
    """Normalize text for matching - strips all non-alphanumeric characters."""
    text = str(text).lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def is_valid_hike_name(hike_name):
    """Check if a hike name is valid."""
    if not hike_name:
        return False
    hike_lower = hike_name.lower().strip()
    if re.match(r'^[\d.]+$', hike_lower):
        return False
    skip_patterns = [
        'alternate wednesday', 'alternate friday', 'alternate hike',
        'alternate wed', 'canceled', 'cancel', 'tbd', 'tba',
        'wilderness 12max', 'early start', 'note:', 'firm dates',
    ]
    for pattern in skip_patterns:
        if pattern in hike_lower:
            return False
    meaningful_chars = sum(1 for c in hike_lower if c.isalpha())
    if meaningful_chars < 3:
        return False
    return True

def parse_quarter_sheet(xl, sheet_name):
    """Extract hikes from a quarter sheet."""
    df = pd.read_excel(xl, sheet_name=sheet_name, header=None)
    num_cols = len(df.columns)
    hikes = []
    header_row = None
    for i in range(min(5, len(df))):
        row = [safe_str(df.iloc[i, j]) for j in range(len(df.columns))]
        if 'Month' in row:
            header_row = i
            break
    if header_row is None:
        return hikes
    if num_cols == 6:
        cols = [(0, 1, 2), (3, 4, 5)]
    elif num_cols == 9:
        cols = [(0, 1, 2), (4, 5, 6)]
    elif num_cols == 10:
        cols = [(0, 1, 2), (5, 6, 7)]
    elif num_cols == 11:
        cols = [(0, 1, 2), (6, 7, 8)]
    elif num_cols == 13:
        cols = [(0, 1, 2), (6, 7, 8)]
    else:
        print(f'  WARNING: Unexpected column count {num_cols} for {sheet_name}')
        return hikes
    current_month = None
    for i in range(header_row + 1, len(df)):
        for col_idx, (m_col, d_col, h_col) in enumerate(cols):
            month_val = safe_str(df.iloc[i, m_col])
            day_val = safe_str(df.iloc[i, d_col])
            hike_val = safe_str(df.iloc[i, h_col])
            if not month_val and not day_val and not hike_val:
                continue
            if month_val and month_val in ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']:
                current_month = month_val
            if not hike_val:
                continue
            if hike_val.lower() in ['month', 'hike', 'leader']:
                continue
            if not current_month:
                continue
            if not is_valid_hike_name(hike_val):
                continue
            hikes.append({
                'month': current_month,
                'day': day_val if day_val else '',
                'hike': hike_val
            })
    return hikes

def match_hike(hike_name, trails):
    """Match a hike name to a trail ID."""
    hike_norm = normalize(hike_name)
    hike_words = [w for w in hike_norm.split() if len(w) > 1]
    merged_words = []
    for word in hike_words:
        common_parts = ['gray', 'wolf', 'creek', 'cree', 'river', 'lake', 'peak',
                       'hill', 'mount', 'mt', 'road', 'rd', 'trail', 'tr', 'valley',
                       'pass', 'ridge', 'spit', 'beach', 'park', 'dam', 'fall']
        for part in common_parts:
            if part in word and len(word) > len(part) + 2:
                idx = word.index(part)
                before = word[:idx]
                after = word[idx:]
                if idx == 0:
                    remaining = after[len(part):]
                    if remaining:
                        for next_part in common_parts:
                            if next_part in remaining and len(remaining) > len(next_part) + 2:
                                next_idx = remaining.index(next_part)
                                mid = remaining[:next_idx]
                                rest = remaining[next_idx:]
                                if mid and mid not in merged_words and len(mid) > 2:
                                    merged_words.append(mid)
                                if rest and rest not in merged_words and len(rest) > 2:
                                    merged_words.append(rest)
                                break
                        else:
                            if remaining and remaining not in merged_words and len(remaining) > 2:
                                merged_words.append(remaining)
                    if part and part not in merged_words and len(part) > 2:
                        merged_words.append(part)
                else:
                    if before and before not in merged_words and len(before) > 2:
                        merged_words.append(before)
                    if after and after not in merged_words and len(after) > 2:
                        merged_words.append(after)
                break
    all_hike_words = hike_words + [w for w in merged_words if w not in hike_words]
    if not all_hike_words:
        return None, 0
    best_match = None
    best_score = 0
    for t in trails:
        full_norm = normalize(t.get('fullName', ''))
        name_norm = normalize(t['name'])
        all_text = full_norm + ' ' + name_norm
        score = 0
        words_matched = 0
        for word in all_hike_words:
            if word in all_text:
                score += len(word)
                words_matched += 1
        if words_matched == len(all_hike_words) and len(all_hike_words) > 2:
            score += 10
        if hike_norm in all_text:
            score += 20
        for word in all_hike_words:
            if len(word) > 3 and word in t['name'].lower():
                score += 5
        if score > best_score:
            best_score = score
            best_match = t['id']
    if best_score < 4:
        return None, best_score
    return best_match, best_score

def main():
    schedule_path = r'D:\hiker\SOTHH schedule.xls'
    trails_path = r'D:\hiker\exported_data\trails.json'
    output_path = r'D:\hiker\exported_data\trail_schedule_count.tsv'

    print('Loading trails data...')
    with open(trails_path, 'r', encoding='utf-8') as f:
        trails_data = json.load(f)
    trails = trails_data['trails']
    print(f'Loaded {len(trails)} trails')

    print('\nExtracting hikes from schedule...')
    xl = pd.ExcelFile(schedule_path)
    print(f'Found {len(xl.sheet_names)} sheets: {xl.sheet_names}\n')

    all_hikes = []
    for sheet in xl.sheet_names:
        hikes = parse_quarter_sheet(xl, sheet)
        all_hikes.extend(hikes)
        if hikes:
            print(f'  {sheet}: {len(hikes)} hikes')

    print(f'\nTotal hikes extracted: {len(all_hikes)}')

    print('\nMatching hikes to trails...')
    matched_count = 0
    unmatched_count = 0
    trail_hike_counts = {}

    for hike in all_hikes:
        trail_id, score = match_hike(hike['hike'], trails)
        if trail_id:
            matched_count += 1
            trail_hike_counts[trail_id] = trail_hike_counts.get(trail_id, 0) + 1
        else:
            unmatched_count += 1
            if unmatched_count <= 10:
                print(f'  UNMATCHED ({score}): {hike["hike"]}')

    print(f'\nMatched: {matched_count}')
    print(f'Unmatched: {unmatched_count}')
    if unmatched_count > 10:
        print(f'\n  ...and {unmatched_count - 10} more unmatched hikes')

    print(f'\nWriting schedule count TSV to {output_path}...')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('Trail ID\tTrail Name\tSchedule Count\n')
        for trail in trails:
            trail_id = trail['id']
            name = safe_str(trail.get('fullName', trail['name']))
            count = trail_hike_counts.get(trail_id, 0)
            f.write(f'{trail_id}\t{name}\t{count}\n')

    print(f'[OK] Saved schedule counts for {len(trails)} trails')

    # Show top trails
    print('\n=== TOP 10 BY SCHEDULE COUNT ===')
    sorted_trails = sorted(trail_hike_counts.items(), key=lambda x: x[1], reverse=True)
    for trail_id, count in sorted_trails[:10]:
        trail = next((t for t in trails if t['id'] == trail_id), None)
        if trail:
            name = safe_str(trail.get('fullName', trail['name']))[:50]
            print(f'  {trail_id} ({name}): {count}')

    print(f'\nTotal unmatched: {unmatched_count}')
    if unmatched_count > 0:
        print(f'\nUnmatched hikes ({unmatched_count}):')
        # Get all unmatched hike names
        unmatched_hikes = []
        for hike in all_hikes:
            trail_id, score = match_hike(hike['hike'], trails)
            if not trail_id:
                h = hike['hike']
                if h not in unmatched_hikes:
                    unmatched_hikes.append(h)
        for h in unmatched_hikes[:20]:
            print(f'  - {h}')
        if len(unmatched_hikes) > 20:
            print(f'  ...and {len(unmatched_hikes) - 20} more')

if __name__ == '__main__':
    main()
