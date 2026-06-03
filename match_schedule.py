"""
Match schedule hikes to trail database and update month scores.

Reads SOTHH schedule.xls, matches hikes to trails, calculates month scores,
and updates exported_data/trails.json in-place.

Score formula:
  base = 1 if trail has quarter data in Excel, 0 otherwise
  score = base + (hike_count_in_month × 2), capped at 9
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
    # Replace all non-alphanumeric, non-space characters with space
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def is_valid_hike_name(hike_name):
    """Check if a hike name is valid (not a number, placeholder, or metadata)."""
    if not hike_name:
        return False
    
    hike_lower = hike_name.lower().strip()
    
    # Skip pure numbers or decimal numbers
    if re.match(r'^[\d.]+$', hike_lower):
        return False
    
    # Skip common placeholders
    skip_patterns = [
        'alternate wednesday',
        'alternate friday',
        'alternate hike',
        'alternate wed',
        'canceled',
        'cancel',
        'tbd',
        'tba',
        'tba/',
        'tbd/',
        'wilderness 12max',
        'early start',
        'note:',
        'firm dates',
    ]
    
    for pattern in skip_patterns:
        if pattern in hike_lower:
            return False
    
    # Skip if hike name is too short (less than 3 meaningful chars)
    meaningful_chars = sum(1 for c in hike_lower if c.isalpha())
    if meaningful_chars < 3:
        return False
    
    return True

def parse_quarter_sheet(xl, sheet_name):
    """Extract hikes from a quarter sheet based on its column structure."""
    df = pd.read_excel(xl, sheet_name=sheet_name, header=None)
    num_cols = len(df.columns)
    hikes = []
    
    # Find header row (contains 'Month')
    header_row = None
    for i in range(min(5, len(df))):
        row = [safe_str(df.iloc[i, j]) for j in range(len(df.columns))]
        if 'Month' in row:
            header_row = i
            break
    
    if header_row is None:
        return hikes
    
    # Column mappings based on structure
    if num_cols == 6:
        # 2Q22 - 2Q23: Month, Wed, Hike, Month, Fri, Hike
        cols = [
            (0, 1, 2),  # Month, Wed, Hike (Wed)
            (3, 4, 5)   # Month, Fri, Hike (Fri)
        ]
    elif num_cols == 9:
        # 4Q23 - 2Q24: Month, Wed, Hike, Leader, Month, Fri, Hike, Leader,
        cols = [
            (0, 1, 2),  # Month, Wed, Hike
            (4, 5, 6)   # Month, Fri, Hike
        ]
    elif num_cols == 10:
        # 2Q26, 1Q26, 4Q25: Month, Wed, Hike, Leader, ?, Month, Fri, Hike, Leader, ?
        cols = [
            (0, 1, 2),  # Month, Wed, Hike
            (5, 6, 7)   # Month, Fri, Hike
        ]
    elif num_cols == 11:
        # 3Q24 - 1Q25: Month, Wed, Hike, min, $, Leader, Month, Fri, Hike, min, $, Leader
        cols = [
            (0, 1, 2),  # Month, Wed, Hike
            (6, 7, 8)   # Month, Fri, Hike
        ]
    elif num_cols == 13:
        # 3Q24+: Month, Wed, Hike, min, $, Leader, Month, Fri, Hike, min, $, Leader,
        cols = [
            (0, 1, 2),  # Month, Wed, Hike
            (6, 7, 8)   # Month, Fri, Hike
        ]
    else:
        print(f'  WARNING: Unexpected column count {num_cols} for {sheet_name}')
        return hikes
    
    # Parse data rows
    current_month = None
    for i in range(header_row + 1, len(df)):
        for col_idx, (m_col, d_col, h_col) in enumerate(cols):
            month_val = safe_str(df.iloc[i, m_col])
            day_val = safe_str(df.iloc[i, d_col])
            hike_val = safe_str(df.iloc[i, h_col])
            
            # Skip empty rows
            if not month_val and not day_val and not hike_val:
                continue
            
            # Update month if found
            if month_val and month_val in ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']:
                current_month = month_val
            
            # Skip if no hike name
            if not hike_val:
                continue
            
            # Skip header-like rows
            if hike_val.lower() in ['month', 'hike', 'leader']:
                continue
            
            # Skip if no month
            if not current_month:
                continue
            
            # Skip invalid hike names (numbers, placeholders, etc.)
            if not is_valid_hike_name(hike_val):
                continue
            
            hikes.append({
                'month': current_month,
                'day': day_val if day_val else '',
                'hike': hike_val
            })
    
    return hikes

def match_hike(hike_name, trails):
    """Match a hike name to a trail ID using relaxed fuzzy matching."""
    hike_norm = normalize(hike_name)
    hike_words = [w for w in hike_norm.split() if len(w) > 1]
    
    # Also split merged words (e.g., "graywolf" -> "gray", "wolf")
    merged_words = []
    for word in hike_words:
        # Check if word contains common trail name parts
        common_parts = ['gray', 'wolf', 'creek', 'cree', 'river', 'lake', 'peak',
                       'hill', 'mount', 'mt', 'road', 'rd', 'trail', 'tr', 'valley',
                       'pass', 'ridge', 'spit', 'beach', 'park', 'dam', 'fall']
        for part in common_parts:
            if part in word and len(word) > len(part) + 2:
                # Split the word at the part
                idx = word.index(part)
                before = word[:idx]
                after = word[idx:]
                # If part is at the beginning, split at the end of the part
                if idx == 0:
                    # Try to find the next common part in 'after', skipping the current part
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
                            # No next part found, just add the remaining part
                            if remaining and remaining not in merged_words and len(remaining) > 2:
                                merged_words.append(remaining)
                    # Also add the current part if it's long enough
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
        
        # Bonus: if ALL words matched
        if words_matched == len(all_hike_words) and len(all_hike_words) > 2:
            score += 10
        
        # Bonus: if hike_norm is substring of trail text
        if hike_norm in all_text:
            score += 20
        
        # Bonus: words in trail name (not just fullName)
        for word in all_hike_words:
            if len(word) > 3 and word in t['name'].lower():
                score += 5
        
        if score > best_score:
            best_score = score
            best_match = t['id']
    
    # Minimum score threshold to avoid bad matches
    if best_score < 4:
        return None, best_score
    
    return best_match, best_score

def extract_schedule_to_json(schedule_path, output_path, trails):
    """Extract schedule hikes to JSON for the web app."""
    print('Extracting schedule data to JSON...')
    xl = pd.ExcelFile(schedule_path)
    
    all_hikes = []
    for sheet in xl.sheet_names:
        hikes = parse_quarter_sheet(xl, sheet)
        all_hikes.extend(hikes)
        if hikes:
            print(f'  {sheet}: {len(hikes)} hikes')
    
    print(f'Total hikes extracted: {len(all_hikes)}')
    
    # Match hikes to trail IDs
    matched_count = 0
    unmatched_count = 0
    hikes_with_ids = []
    for hike in all_hikes:
        trail_id, score = match_hike(hike['hike'], trails)
        if trail_id:
            matched_count += 1
            hikes_with_ids.append({
                'month': hike['month'],
                'day': hike['day'],
                'hike': hike['hike'],
                'trail_id': trail_id
            })
        else:
            unmatched_count += 1
            if unmatched_count <= 10:
                print(f'  UNMATCHED ({score}): {hike["hike"]}')
    
    print(f'  Matched: {matched_count}, Unmatched: {unmatched_count}')
    
    # Group by month
    hikes_by_month = {}
    for hike in hikes_with_ids:
        month = hike['month']
        if month not in hikes_by_month:
            hikes_by_month[month] = []
        day = hike['day']
        if day:
            hikes_by_month[month].append({
                'day': int(day),
                'hike': hike['hike'],
                'trail_id': hike['trail_id']
            })
    
    # Sort days within each month
    for month in hikes_by_month:
        hikes_by_month[month].sort(key=lambda x: x['day'])
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(hikes_by_month, f, indent=2)
    
    print(f'[OK] Saved {len(hikes_by_month)} months to {output_path}')
    return hikes_by_month

def main():
    schedule_path = r'D:\hiker\SOTHH schedule.xls'
    trails_path = r'D:\hiker\exported_data\trails.json'
    schedule_json_path = r'D:\hiker\exported_data\schedule.json'
    
    # Load trails data first
    print('Loading trails data...')
    with open(trails_path, 'r', encoding='utf-8') as f:
        trails_data = json.load(f)
    trails = trails_data['trails']
    print(f'Loaded {len(trails)} trails')
    
    # Extract schedule data to JSON first
    extract_schedule_to_json(schedule_path, schedule_json_path, trails)
    
    print()
    print('Loading schedule file...')
    xl = pd.ExcelFile(schedule_path)
    
    print(f'Found {len(xl.sheet_names)} sheets: {xl.sheet_names}')
    print()
    
    # Step 1: Extract all hikes from schedule
    print('Extracting hikes from schedule...')
    all_hikes = []
    for sheet in xl.sheet_names:
        hikes = parse_quarter_sheet(xl, sheet)
        all_hikes.extend(hikes)
        if hikes:
            print(f'  {sheet}: {len(hikes)} hikes')
    
    print(f'\nTotal hikes extracted: {len(all_hikes)}')
    
    # Step 2: Load trails data
    print('\nLoading trails data...')
    with open(trails_path, 'r', encoding='utf-8') as f:
        trails_data = json.load(f)
    
    trails = trails_data['trails']
    print(f'Loaded {len(trails)} trails')
    
    # Step 3: Match hikes to trails
    print('\nMatching hikes to trails...')
    matched_count = 0
    unmatched_count = 0
    trail_hike_counts = {}  # trail_id -> {month -> count}
    
    for hike in all_hikes:
        trail_id, score = match_hike(hike['hike'], trails)
        
        if trail_id:
            matched_count += 1
            if trail_id not in trail_hike_counts:
                trail_hike_counts[trail_id] = {}
            
            month = hike['month']
            trail_hike_counts[trail_id][month] = trail_hike_counts[trail_id].get(month, 0) + 1
        else:
            unmatched_count += 1
            if unmatched_count <= 10:
                print(f'  UNMATCHED ({score}): {hike["hike"]}')
    
    print(f'\nMatched: {matched_count}')
    print(f'Unmatched: {unmatched_count}')
    
    if unmatched_count > 10:
        print(f'\n  ...and {unmatched_count - 10} more unmatched hikes')
    
    # Step 4: Calculate month scores
    print('\nCalculating month scores...')
    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    # Find which trails have quarter data
    trails_with_quarters = set()
    for t in trails:
        months = t.get('seasonal', {}).get('availableMonths', [])
        if months:
            trails_with_quarters.add(t['id'])
    
    print(f'Trails with quarter data: {len(trails_with_quarters)}')
    print(f'Trails with schedule data: {len(trail_hike_counts)}')
    
    # Step 5: Update trails.json
    print('\nUpdating trails.json...')
    updated_count = 0
    
    for trail in trails:
        trail_id = trail['id']
        
        month_scores = {}
        
        # Base score: 1 if has quarters, 0 otherwise
        base = 1 if trail_id in trails_with_quarters else 0
        
        # Calculate scores for each month
        for month in month_names:
            hike_count = trail_hike_counts.get(trail_id, {}).get(month, 0)
            score = base + (hike_count * 2)
            score = min(score, 9)
            month_scores[month] = score
        
        # Update seasonal data - preserve bestSeason if it exists
        old_seasonal = trail.get('seasonal', {})
        old_best_season = old_seasonal.get('bestSeason', '') if isinstance(old_seasonal, dict) else ''
        trail['seasonal'] = month_scores
        if old_best_season:
            trail['seasonal']['bestSeason'] = old_best_season
        updated_count += 1
    
    print(f'Updated {updated_count} trails with month scores')
    
    # Step 6: Save updated trails.json
    print('\nSaving updated trails.json...')
    with open(trails_path, 'w', encoding='utf-8') as f:
        json.dump(trails_data, f, indent=2, ensure_ascii=False)
    
    print('[OK] Updated trails.json saved')
    
    # Step 7: Summary statistics
    print('\n=== SUMMARY ===')
    print(f'Total hikes in schedule: {len(all_hikes)}')
    print(f'Matched to trails: {matched_count}')
    print(f'Unmatched: {unmatched_count}')
    print(f'Trails updated: {updated_count}')
    
    # Show some examples
    print('\n=== EXAMPLES ===')
    for trail_id, counts in sorted(trail_hike_counts.items())[:5]:
        trail = next((t for t in trails if t['id'] == trail_id), None)
        if trail:
            name = safe_str(trail.get('fullName', trail['name']))[:50]
            base = 1 if trail_id in trails_with_quarters else 0
            total_hikes = sum(counts.values())
            top_months = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:3]
            print('  ' + trail_id + ' (' + name + '): ' + str(total_hikes) + ' hikes, base=' + str(base))
            for m, c in top_months:
                score = min(base + (c * 2), 9)
                print('    ' + m + ': ' + str(c) + ' hikes -> score ' + str(score))

if __name__ == '__main__':
    main()
