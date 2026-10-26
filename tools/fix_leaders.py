import json

with open(r'D:\hiker\exported_data\schedule_sothh.json') as f:
    d = json.load(f)

sep = d.get('schedule', {}).get('Sep', [])

# Fix the two entries per the email:
# September 11 - Maiden Peak - Leader Bev  → deer-park-to, leader=Bev
# September 18 - Badger Valley to Moose Lake - Leader Jeanne → badger-valley, leader=Jeanne
for e in sep:
    if e.get('day') == 11:
        e['trail_id'] = 'deer-park-to'   # Maiden Peak
        e['leader'] = 'Bev'
    if e.get('day') == 18:
        e['trail_id'] = 'badger-valley'  # Badger Valley
        e['leader'] = 'Jeanne'

with open(r'D:\hiker\exported_data\schedule_sothh.json', 'w') as f:
    json.dump(d, f, indent=2)

# Verify
with open(r'D:\hiker\exported_data\schedule_sothh.json') as f:
    d2 = json.load(f)
sep2 = d2.get('schedule', {}).get('Sep', [])
print('Fixed Sep entries:')
for e in sep2:
    if e.get('day') in [11, 18]:
        print(' day=%s tid=%s leader=%s' % (e.get('day'), e.get('trail_id'), e.get('leader')))