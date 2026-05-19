# Hiker Trail Browser

A static React web application for browsing and managing SOTHH trail data.

## Quick Start

### Run the App

Open `hiker-app/dist/index.html` in any browser. No server required - it works from `file://` protocol.

### Update Trail Data

1. Update the Excel file: `D:\hiker\Hike Data BaseM.xls`
2. Run the extraction script:
   ```bash
   python D:\hiker\extract_trails_xls.py
   ```
3. Match schedule hikes to trails:
   ```bash
   python D:\hiker\match_schedule.py
   ```
4. Copy data to the app:
   ```bash
   copy D:\hiker\exported_data\trails.json D:\hiker\hiker-app\public\data\trails.json
   copy D:\hiker\exported_data\trail_details.json D:\hiker\hiker-app\public\data\trail_details.json
   copy D:\hiker\exported_data\lookup.json D:\hiker\hiker-app\public\data\lookup.json
   ```
5. Rebuild the app:
   ```bash
   cd D:\hiker\hiker-app
   npm run build
   ```

## Data Structure

### Source Files

| File | Description |
|------|-------------|
| `Hike Data BaseM.xls` | Main trail database (179 trails, 182 sheets) |
| `SOTHH schedule.xls` | Hike schedule (2022-2026, 17 quarters) |

### Extracted JSON Files

| File | Description |
|------|-------------|
| `trails.json` | Main trail database with scores |
| `trail_details.json` | Extended info (descriptions, leaders, pros, others) |
| `lookup.json` | Reference data (difficulties, parking levels, months) |

### Month Score System

Each trail has month scores (0-9) for Jan through Dec:

```json
{
  "seasonal": {
    "Jan": 3,
    "Feb": 1,
    "Mar": 1,
    ...
  }
}
```

**Formula:**
```
score = base + (hike_count * 2)
score = min(score, 9)
```

- **base = 1** if trail has quarter data in Excel (seasonally available)
- **base = 0** if no quarter data
- **+2** for each actual hike done in that month from the schedule

## Scripts

### extract_trails_xls.py

Extracts trail data from `Hike Data BaseM.xls`:
- Reads Index sheet (distance, elevation, difficulty, quarters)
- Reads individual trail sheets (parking, range, descriptions)
- Outputs to `exported_data/`

### match_schedule.py

Matches schedule hikes to trail IDs:
- Parses all 17 quarter sheets from `SOTHH schedule.xls`
- Uses fuzzy matching to match hike names to trail IDs
- Calculates month scores based on schedule data
- Updates `exported_data/trails.json` in-place

## App Features

- **Browse** all 178+ trails with grid layout
- **Search** across all fields (name, notes, parking, etc.)
- **Filter** by distance, elevation, difficulty, months
- **Sort** by Name, Popularity, Elevation (↑/↓), or Distance (↑/↓)
- **Trail Detail** pages with full information
- **Edit** trail details (description, notes, pros, others, leaders, stats)
- **Export Merged Data** - Downloads updated JSON files with your edits
- **Copy Report** - Generate formatted text for trail reports

## Monthly Availability Display

The app shows monthly availability as text labels (e.g., "Apr, Jun, Jul, Dec"). Higher scores (more hikes) in the `seasonal` dict indicate more popular months.

## Sort Behavior

- **Name** — alphabetical by trail name (default)
- **Popularity** — sorted by sum of scores for selected months. When no months are selected, all 12 months are used.
- **Elevation ↑/↓** — sorted by `elevationStart` (ascending or descending)
- **Distance ↑/↓** — sorted by `distance` (ascending or descending)

## File Structure

```
D:\hiker\
├── Hike Data BaseM.xls        # Source database
├── SOTHH schedule.xls          # Hike schedule
├── extract_trails_xls.py       # Data extraction script
├── match_schedule.py           # Schedule matching script
├── exported_data/
│   ├── trails.json             # Main trail data
│   ├── trail_details.json      # Extended trail info
│   └── lookup.json             # Reference data
└── hiker-app/                  # React application
    ├── public/data/            # JSON data files
    ├── src/
    │   ├── components/         # React components
    │   ├── pages/              # Page components
    │   ├── hooks/              # Custom hooks
    │   └── utils/              # Utility functions
    ├── dist/                   # Production build
    │   └── index.html          # Single-file app
    └── package.json
```

## Troubleshooting

### Blank page on open
- The app works from `file://` protocol
- If blank, try hard refresh (Ctrl+Shift+R)

### CORS errors
- Ensure you're using the `dist/index.html` file, not the source files
- The app uses MemoryRouter for file:// compatibility

### Data not updating
- Run both scripts in order: extract first, then match
- Copy updated JSON files to `hiker-app/public/data/`
- Rebuild with `npm run build`

## License

See LICENSE file for details.
