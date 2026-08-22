import json, os

h = r'D:\hiker\exported_data\schedule_history'
files = sorted(os.listdir(h))
latest = os.path.join(h, files[-1]) if files else None

if latest:
    with open(latest) as f:
        data = json.load(f)
    schedule = data.get('schedule', {})
    
    # Write only the schedule object (not the timestamp wrapper)
    with open(r'D:\hiker\exported_data\schedule_sothh.json', 'w') as out:
        json.dump(schedule, out, indent=2)
    
    print('Wrote schedule object to schedule_sothh.json')
    print('Sep count:', len(schedule.get('Sep', [])))
    
    # Verify
    with open(r'D:\hiker\exported_data\schedule_sothh.json') as v:
        d = json.load(v)
        print('Keys after read:', list(d.keys()))
        print('Sep count after read:', len(d.get('Sep', [])))