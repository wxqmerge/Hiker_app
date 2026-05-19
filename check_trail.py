import json

with open('exported_data/trails.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

trails = data['trails']

# Check format types
array_count = 0
dict_count = 0

for trail in trails:
    seasonal = trail.get('seasonal', {})
    if isinstance(seasonal, dict):
        # Check if it's the old format (list of months) or new format (month scores)
        first_val = list(seasonal.values())[0] if seasonal else None
        if isinstance(first_val, list):
            array_count += 1
        elif isinstance(first_val, int):
            dict_count += 1
    elif isinstance(seasonal, list):
        array_count += 1

print('Old format (array):', array_count)
print('New format (dict):', dict_count)
print('Total:', array_count + dict_count)

# Check a few trails
trail_ids = ['anderson', 'anderson-lake', 'burnt-hill', '360', 'graywolf']

print('\nSample trails with month scores:')
for trail_id in trail_ids:
    trail = next((t for t in trails if t['id'] == trail_id), None)
    if trail:
        print('\n' + trail['id'] + ':')
        print('  Name:', trail.get('fullName', trail['name']))
        seasonal = trail.get('seasonal', {})
        if isinstance(seasonal, dict):
            months_with_scores = {k: v for k, v in seasonal.items() if v > 0}
            if months_with_scores:
                print('  Months with scores:', months_with_scores)
            else:
                print('  No month scores')
        else:
            print('  Seasonal:', seasonal)
