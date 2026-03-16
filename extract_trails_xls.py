"""
Extract trail data from Hike Data Base.xls (older Excel format)
Uses pandas for easier parsing
"""

import pandas as pd
import json
import re
from pathlib import Path

class TrailExtractor:
    def __init__(self, xls_path):
        self.xls_path = Path(xls_path)
        self.xl_file = pd.ExcelFile(xls_path)
        
    def slugify(self, text, existing_slugs=None):
        """Convert text to URL-friendly slug with uniqueness guarantee"""
        if existing_slugs is None:
            existing_slugs = set()
        
        slug = re.sub(r'[^a-zA-Z0-9\s-]', '', str(text))
        all_words = slug.split()
        
        # Try progressively longer combinations until unique
        for i in range(len(all_words)):
            candidate = '-'.join(all_words[:i+1]).lower().strip('-')
            candidate = re.sub(r'[^a-z0-9-]', '', candidate)
            if candidate and candidate not in existing_slugs:
                return candidate
        
        # Fallback: add counter
        base = all_words[0].lower() if all_words else 'trail'
        counter = 1
        while f"{base}-{counter}" in existing_slugs:
            counter += 1
        return f"{base}-{counter}"
    
    def extract_index_data(self):
        """Extract all trail records from Index sheet"""
        print("\nExtracting Index sheet data...")
        
        index_df = pd.read_excel(self.xls_path, sheet_name='Index', header=None)
        
        # Column mapping (0-indexed)
        COL_DISTANCE = 1      # B
        COL_DISTANCE_EXT = 2  # C  
        COL_ELEV_START = 3    # D
        COL_ELEV_MAX = 4      # E
        COL_RANGE = 7         # H
        COL_Q1 = 8            # I
        COL_Q2 = 9            # J
        COL_Q3 = 10           # K
        COL_Q4 = 11           # L
        COL_DIFFICULTY = 17   # R
        COL_SHORT_NAME = 18   # S
        COL_FULL_NAME = 0     # A
        
        trails = []
        existing_slugs = set()
        short_name_to_id = {}
        
        for idx, row in index_df.iterrows():
            if idx == 0:  # Skip header
                continue
            
            full_name = str(row[COL_FULL_NAME]) if pd.notna(row[COL_FULL_NAME]) else ''
            short_name = str(row[COL_SHORT_NAME]) if pd.notna(row[COL_SHORT_NAME]) else ''
            
            if not full_name:
                continue
            
            # Parse numeric fields
            try:
                distance = float(row[COL_DISTANCE]) if pd.notna(row[COL_DISTANCE]) else None
            except:
                distance = None
                
            try:
                distance_extended = float(row[COL_DISTANCE_EXT]) if pd.notna(row[COL_DISTANCE_EXT]) else None
            except:
                distance_extended = None
                
            try:
                elevation_start = int(float(row[COL_ELEV_START])) if pd.notna(row[COL_ELEV_START]) else None
            except:
                elevation_start = None
                
            try:
                elevation_max = int(float(row[COL_ELEV_MAX])) if pd.notna(row[COL_ELEV_MAX]) else None
            except:
                elevation_max = None
            
            # Parse seasonal availability
            available_months = []
            quarters = {
                COL_Q1: [3, 4, 5],    # Q1 - Spring
                COL_Q2: [6, 7, 8],    # Q2 - Summer
                COL_Q3: [9, 10, 11],  # Q3 - Fall
                COL_Q4: [12, 1, 2]    # Q4 - Winter
            }
            for col, months in quarters.items():
                if pd.notna(row[col]) and str(row[col]) in ['1', 'W', 'Y']:
                    available_months.extend(months)
            available_months = sorted(list(set(available_months)))
            
            trail = {
                'id': self.slugify(full_name, existing_slugs),
                'name': short_name,
                'fullName': full_name,
                'distance': round(distance, 1) if distance else None,
                'distanceExtended': round(distance_extended, 1) if distance_extended else None,
                'elevationStart': elevation_start,
                'elevationMax': elevation_max,
                'difficulty': str(row[COL_DIFFICULTY]) if pd.notna(row[COL_DIFFICULTY]) else 'Unknown',
                'notes': full_name[:200],
                'seasonal': {
                    'availableMonths': available_months,
                    'bestSeason': ''
                }
            }
            
            trails.append(trail)
            existing_slugs.add(trail['id'])
            short_name_to_id[short_name] = trail['id']
        
        print(f"  Extracted {len(trails)} trails")
        return trails, short_name_to_id
    
    def extract_trail_details(self, short_name_to_id):
        """Extract extended details from individual trail sheets"""
        print("\nExtracting trail details from individual sheets...")
        
        skip_sheets = {'Instructions', 'Report', 'Index'}
        details = {}
        sheet_count = 0
        
        for sheet_name in self.xl_file.sheet_names:
            if sheet_name in skip_sheets:
                continue
            
            try:
                df = pd.read_excel(self.xls_path, sheet_name=sheet_name, header=None)
                
                # Read A1 (row 0, col 0)
                a1_content = df.iloc[0, 0] if len(df) > 0 and len(df.columns) > 0 else ''
                
                # Read parking from B4 (row 3, col 1)
                try:
                    parking_raw = df.iloc[3, 1]
                    valid_parking = {'Discover', "Nat'l Park/Golden", 'NW Forest/Golden', 'N/A', 'n/a',
                                   'Am Beau/Golden', 'Limited 2', 'Limited 3', 'Limited 4'}
                    parking = str(parking_raw) if pd.notna(parking_raw) and str(parking_raw) in valid_parking else ''
                except:
                    parking = ''
                
                # Read range from G5 (row 4, col 6)
                try:
                    range_val = df.iloc[4, 6]
                    range_str = str(range_val) if pd.notna(range_val) else ''
                except:
                    range_str = ''
                
                # Read description from A7 onwards (row 6+)
                full_description = ''
                for i in range(6, min(19, len(df))):
                    try:
                        cell_val = df.iloc[i, 0]
                        if pd.notna(cell_val) and str(cell_val).strip():
                            full_description += str(cell_val).strip() + ' '
                    except:
                        pass
                full_description = full_description.strip()
                
                # Read pros from B14 (row 13, col 1)
                try:
                    pros_raw = df.iloc[13, 1]
                    pros = str(pros_raw) if pd.notna(pros_raw) else ''
                except:
                    pros = ''
                
                # Read others from B17 (row 16, col 1)
                try:
                    others_raw = df.iloc[16, 1]
                    others = str(others_raw) if pd.notna(others_raw) else ''
                except:
                    others = ''
                
                # Read leaders from B20 (row 19, col 1)
                leaders = []
                try:
                    leaders_raw = df.iloc[19, 1]
                    if pd.notna(leaders_raw):
                        leaders_str = str(leaders_raw)
                        leaders = [l.strip() for l in leaders_str.replace(';', ',').split(',') if l.strip()]
                except:
                    pass
                
                detail = {
                    'fullDescription': full_description,
                    'pros': pros if pros else None,
                    'others': others if others else None,
                    'leaders': leaders,
                    'range': range_str if range_str else None,
                    'parking': parking if parking else None
                }
                
                # Match sheet name to trail ID using short_name_to_id mapping
                trail_id = None
                
                # Try exact match
                trail_id = short_name_to_id.get(sheet_name)
                
                # Try normalized match
                if not trail_id:
                    norm_sheet = sheet_name.replace('_', ' ').replace('-', ' ').lower()
                    for short_name, tid in short_name_to_id.items():
                        norm_short = short_name.lower()
                        if norm_short == norm_sheet or norm_short in norm_sheet or norm_sheet in norm_short:
                            trail_id = tid
                            break
                
                if trail_id:
                    details[trail_id] = detail
                    sheet_count += 1
                    print(f"  Sheet '{sheet_name}' -> Trail ID '{trail_id}'")
                else:
                    print(f"  WARNING: No trail found for sheet '{sheet_name}'")
                    
            except Exception as e:
                print(f"  Error reading sheet '{sheet_name}': {e}")
                continue
        
        print(f"  Extracted details for {sheet_count} trails")
        return details
    
    def merge_details_into_trails(self, trails, details):
        """Merge parking and range from details into main trail records"""
        print("\nMerging trail details into main records...")
        
        merged_count = 0
        for trail in trails:
            trail_id = trail['id']
            if trail_id in details:
                detail = details[trail_id]
                if detail.get('parking'):
                    trail['parking'] = detail['parking']
                if detail.get('range'):
                    trail['range'] = detail['range']
                merged_count += 1
        
        print(f"  Merged details for {merged_count} trails")
        return trails
    
    def generate_lookup_data(self, trails):
        """Generate lookup tables from extracted data"""
        print("\nGenerating lookup tables...")
        
        difficulties = sorted(set(t['difficulty'] for t in trails if t.get('difficulty')))
        difficulty_order = {'Easy': 1, 'Easy to Mod': 2, 'Moderate': 3, 'Mod to Diff': 4, 'Difficult': 5, 'Unknown': 99}
        
        difficulties_list = [
            {'code': d, 'order': difficulty_order.get(d, 99), 'label': d}
            for d in difficulties
        ]
        
        parking_levels = sorted(set(t['parking'] for t in trails if t.get('parking')))
        
        lookup = {
            'difficulties': difficulties_list,
            'parkingLevels': {p: f"Parking level: {p}" for p in parking_levels},
            'months': ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"]
        }
        
        print(f"  {len(difficulties_list)} difficulty levels")
        print(f"  {len(parking_levels)} parking levels: {parking_levels}")
        return lookup
    
    def add_difficulty_order(self, trails):
        """Add difficulty ordering for sorting"""
        order_map = {'Easy': 1, 'Easy to Mod': 2, 'Moderate': 3, 'Mod to Diff': 4, 'Difficult': 5, 'Unknown': 99}
        for trail in trails:
            trail['difficultyOrder'] = order_map.get(trail.get('difficulty'), 99)
        return trails
    
    def export_data(self, output_dir):
        """Main method to extract and export all data"""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Step 1: Extract index data
        trails, short_name_to_id = self.extract_index_data()
        
        # Step 2: Extract trail details
        details = self.extract_trail_details(short_name_to_id)
        
        # Step 3: Merge details into trails
        trails = self.merge_details_into_trails(trails, details)
        
        # Step 4: Add difficulty order
        trails = self.add_difficulty_order(trails)
        
        # Step 5: Generate lookup data
        lookup = self.generate_lookup_data(trails)
        
        # Step 6: Write JSON files
        print("\nWriting output files...")
        
        trails_data = {'trails': trails}
        with open(output_path / 'trails.json', 'w', encoding='utf-8') as f:
            json.dump(trails_data, f, indent=2, ensure_ascii=False)
        print(f"  [OK] trails.json ({len(trails)} records)")
        
        with open(output_path / 'lookup.json', 'w', encoding='utf-8') as f:
            json.dump(lookup, f, indent=2, ensure_ascii=False)
        print(f"  [OK] lookup.json")
        
        details_export = {}
        for trail_id, detail in details.items():
            details_export[trail_id] = {
                'fullDescription': detail.get('fullDescription', ''),
                'leaders': detail.get('leaders', []),
                'pros': detail.get('pros', ''),
                'others': detail.get('others', '')
            }
        with open(output_path / 'trail_details.json', 'w', encoding='utf-8') as f:
            json.dump(details_export, f, indent=2, ensure_ascii=False)
        print(f"  [OK] trail_details.json ({len(details_export)} records)")
        
        print(f"\n[OK] Data extraction complete!")
        print(f"   Output directory: {output_path.absolute()}")
        
        return {'trails': trails, 'details': details, 'lookup': lookup}

if __name__ == '__main__':
    xls_path = r'D:\hiker\Hike Data Base.xls'
    output_dir = r'D:\hiker\exported_data'
    
    extractor = TrailExtractor(xls_path)
    result = extractor.export_data(output_dir)
    
    print("\n[SUMMARY]:")
    print(f"   Trails extracted: {len(result['trails'])}")
    print(f"   Details extracted: {len(result['details'])}")
    print(f"   Difficulty levels: {len(result['lookup']['difficulties'])}")
    
    if result['trails']:
        print("\n[SAMPLE TRAIL]:")
        sample = result['trails'][0]
        print(f"   ID: {sample['id']}")
        print(f"   Name: {sample['name']}")
        print(f"   Distance: {sample['distance']} mi")
        print(f"   Parking: {sample.get('parking', 'N/A')}")
        print(f"   Range: {sample.get('range', 'N/A')}")
