# Hike Database Web App

A static React web application for browsing hiking trail data from the Olympic Peninsula region.

## Overview

This app displays 178 hiking trails with full search, filter, and navigation capabilities. Includes a Schedule Builder for planning monthly hikes and a Trail Manager for CRUD operations. All trail data is stored in IndexedDB for persistence across sessions and rebuilds.

## Browse Features

### Trail Browser
- View all 178 trails in a responsive grid layout
- Each card shows:
  - Full trail name (e.g., "Heart of the Forest")
  - Difficulty badge (Easy, Easy to Mod, Moderate, Mod to Diff, Difficult)
  - Distance with extended option (e.g., "5.0 mi / 5.5 mi")
  - Elevation range (e.g., "650' - 850'")
  - Parking type (Discover, Nat'l Park/Golden, N/A, etc.)
  - Ride cost (e.g., "ride-$5")
  - Available months (if seasonal)
  - Best season (if specified)

### Search & Filters
- **Full-text search** - Searches trail names across all fields (name, notes, parking, difficulty, seasonal months)
- **Distance filter** - Slider to set maximum distance (0-20 miles)
- **Elevation filter** - Slider to set maximum elevation (0-5000 ft)
- **Difficulty filter** - Click to select one or more difficulty levels
- **Month filter** - Click months to filter by seasonal availability

### Trail Detail Page
Click any trail card to view:
- **Header**: Full name and difficulty rating
- **Stats Grid** (all on one line):
  - Distance (miles)
  - Elevation gain (min ft - max ft)
  - Parking type
  - Ride cost/range
- **Description** - Full trail description
- **Notes** - Trail highlights and warnings
- **Available Months** - Seasonal availability badges
- **Best Season** - Preferred hiking season
- **Pros** - Planner notes (hover shows "Field: pros")
- **Others** - Additional info (hover shows "Field: others")
- **Trail Leaders** - Regular guides (blue badges)

### Navigation
Located at top of trail detail page:
- **← Browse** - Return to trail browser
- **Trail X of 178** - Current position indicator
- **Previous / Next** - Navigate between trails
- **Copy Report** - Copy formatted trail report

### Copy Report Feature
Generates formatted text with full description:

```
Heart of the Forest◆︎  [Easy to Mod]    5-5.5 / 650'-850'    Nat'l Park/Golden    ride-$5
This is a pleasant nature trail leaving from Loop "E" in the Heart of the Hills Campground @ ~ 1,400'. It offers beautiful, old-growth trees, plenty of fern varieties, and other flora in a rainforest-type ecosystem.  While hiking on this trail, carefully cross puncheon walkways, as they can be slippery.  Hikers go to a big, fallen tree above Lake Creek, which makes a good turn-around point before leaving the Natl. Park boundary.
```

**Ride cost formula:** Based on range value:
- < 30 minutes = ride-$3
- 30-59 minutes = ride-$5
- 60-89 minutes = ride-$7
- >= 90 minutes = ride-$10

## Trail Manager

Navigate to `/trails` to manage your trail data:

- **Index Numbers** — Each trail shows its position in the list
- **Search** — Filter by trail name, full name, or ID
- **New Trail** — Create a new trail with a generated ID
- **Edit** — Navigate to trail detail page to modify fields
- **Delete** — Remove trails with confirmation dialog
- **Import/Export** — Backup and restore trail data as JSON
- **Export for Excel** — Generate `export_for_excel.json` for Python script

## Schedule Builder

Two-panel drag-and-drop interface for planning monthly hikes:

- **Left panel**: Available hikes (all 178 trails, filterable with same filters as browse)
- **Right panel**: Wed/Fri dates for selected month
- **Drag-and-drop**: Hikes from left panel to dates, between dates to reschedule, back to left to unassign
- **Scheduled section**: Toggle to view assigned hikes with day-number badges
- **Import/Export**: Settings gear menu for schedule data, hike edits, and import
- **Debug mode**: Toggle to show hike index badges and console logging
- **Per-month storage**: Schedules stored in localStorage under `hiker-schedule` key

## Tech Stack

- React 19 with Vite 8
- React Router (MemoryRouter)
- Tailwind CSS 4
- IndexedDB via `idb` library (trail data persistence)
- Static JSON data embedded at build time (no backend required)
- Vitest + jsdom + testing-library + fake-indexeddb (157 tests)

---

## Development

### Prerequisites
- Node.js 16+ installed

### Installation

```bash
cd hiker-app
npm install
```

### Run Dev Server

```bash
npm run dev
```

The app will be available at http://localhost:5173

### Build for Production

```bash
npm run build
```

Production files will be in the `dist/` directory.

### Run Tests

```bash
npm run test
```

### Run Linter

```bash
npm run lint
```

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project at [vercel.com](https://vercel.com)
3. Deploy - automatic configuration via `vercel.json`

### Netlify

1. Push code to GitHub  
2. Import project at [netlify.com](https://netlify.com)
3. Build command: `npm run build`
4. Publish directory: `dist`

### GitHub Pages

```bash
npm install -D gh-pages
```

Add to `package.json`:
```json
"homepage": "https://yourusername.github.io/hiker-app",
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}
```

Then run: `npm run deploy`

## Data Structure

### trails.json (Main trail database)
```json
{
  "trails": [
    {
      "id": "360-rd",
      "name": "360 Rd",
      "fullName": "360 Road/Lookout Hill Rd. off of Palo Alto Rd.",
      "distance": 5.5,
      "distanceExtended": 6.0,
      "elevationStart": 575,
      "elevationMax": 934,
      "difficulty": "Easy",
      "parking": "Limited 2",
      "range": "76",
      "notes": "Trail highlights and notes",
      "seasonal": {
        "Jan": 0, "Feb": 0, "Mar": 1, "Apr": 2,
        "May": 3, "Jun": 2, "Jul": 0, "Aug": 0,
        "Sep": 0, "Oct": 0, "Nov": 0, "Dec": 0
      },
      "difficultyOrder": 1
    }
  ]
}
```

### lookup.json (Reference data)
```json
{
  "difficulties": [
    { "code": "Easy", "order": 1, "label": "Easy" },
    { "code": "Easy to Mod", "order": 2, "label": "Easy to Mod" },
    { "code": "Moderate", "order": 3, "label": "Moderate" },
    { "code": "Mod to Diff", "order": 4, "label": "Mod to Diff" },
    { "code": "Difficult", "order": 5, "label": "Difficult" }
  ],
  "parkingLevels": {},
  "months": ["January", "February", "March", ...]
}
```

### trail_details.json (Extended information)
```json
{
  "360-rd": {
    "fullDescription": "Complete trail description from source...",
    "pros": "Planner notes about trail pros",
    "others": "Additional information",
    "leaders": ["Pat", "Diane"]
  }
}
```

### schedule.json (Schedule hikes)
```json
{
  "Jun": [
    { "day": 3, "hike": "Elwha Delta (Place Road )", "trail_id": "elwha" },
    { "day": 5, "hike": "Mt. Townsend", "trail_id": "mt-townsend" }
  ]
}
```

## Updating Trail Data

Trail data is stored in `public/data/trails.json`. To update:

1. Edit the source Excel file (`Hike Data Base.xls`)
2. Run the extraction script:
   ```bash
   python D:\hiker\extract_trails_xls.py
   ```
3. Match schedule hikes to trails:
   ```bash
   python D:\hiker\match_schedule.py
   ```
4. Copy new JSON files to `hiker-app/public/data/`
5. Rebuild: `npm run build`

## Project Structure

```
hiker-app/
├── public/
│   └── data/
│       ├── trails.json          # Main trail database (178 trails)
│       ├── lookup.json          # Reference data
│       ├── trail_details.json   # Extended trail info
│       └── schedule.json        # Schedule hikes with trail IDs
├── src/
│   ├── components/
│   │   ├── TrailCard.jsx        # Individual trail card
│   │   ├── TrailList.jsx        # Trail grid/list
│   │   └── FilterPanel.jsx      # Search/filter controls
│   ├── pages/
│   │   ├── Home.jsx             # Main browse page
│   │   ├── TrailDetail.jsx      # Trail detail view
│   │   ├── TrailManager.jsx     # Trail CRUD management
│   │   └── ScheduleBuilder.jsx  # Schedule builder
│   ├── hooks/
│   │   ├── useTrailStore.js     # IndexedDB CRUD with smart merge
│   │   ├── useTrails.js         # Data fetching & filtering
│   │   ├── useTrailDetails.js   # Trail details loading
│   │   └── useFilters.js        # Filter state & sorting
│   ├── utils/
│   │   ├── filterTrails.js      # Shared filter/sort logic
│   │   ├── formatTrail.js       # Shared trail formatting
│   │   ├── constants.js         # Shared constants
│   │   ├── report.js            # Report generation utilities
│   │   ├── data.js              # Trail details access
│   │   └── io.js                # File import/export utilities
│   ├── test/                    # Test suite (157 tests)
│   │   ├── setup.ts             # IndexedDB mock (fake-indexeddb)
│   │   ├── utils/
│   │   ├── hooks/
│   │   ├── components/
│   │   └── pages/
│   ├── App.jsx                  # Router setup
│   ├── main.jsx                 # Entry point
│   └── index.css                # Global styles
├── package.json
├── vite.config.js
├── tailwind.config.js
└── vercel.json
```

## License

MIT
