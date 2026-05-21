# Hiker Trail Browser - Architecture

## Overview

A static React web application for browsing and managing SOTHH trail data. The app runs entirely in the browser with no backend server, using embedded JSON data and localStorage for persistence.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Build Tool | Vite 8 |
| Routing | React Router (MemoryRouter) |
| Styling | Tailwind CSS 4 |
| Data Format | JSON |
| Source Data | Microsoft Excel (.xls) |
| Processing | Python 3 |
| Testing | Vitest + jsdom + testing-library |

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User (Browser)                       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              hiker-app/dist/index.html                  │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Embedded React App                   │  │
│  │                                                   │  │
│  │  ┌──────────┐  ┌──────────────────────┐         │  │
│  │  │  Home    │  │  ScheduleBuilder     │         │  │
│  │  └──────────┘  └──────────────────────┘         │  │
│  │                                                   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │  │
│  │  │  Search  │  │ Settings │  │  TrailDetail │   │  │
│  │  └──────────┘  └──────────┘  └──────────────┘   │  │
│  │                                                   │  │
│  │  ┌───────────────────────────────────────────┐   │  │
│  │  │           Custom Hooks                    │   │  │
│  │  │  useTrailStore, useTrails, useFilters     │   │  │
│  │  └───────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Browser IndexedDB                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  hiker-trails (DB)                                │  │
│  │  ┌─────────────┐  ┌─────────────┐                │  │
│  │  │  trails     │  │  details    │                │  │
│  │  │  (key: id)  │  │  (key: id)  │                │  │
│  │  └─────────────┘  └─────────────┘                │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

### Data Pipeline

```
Excel Files (.xls)
       │
       ▼
┌──────────────────────┐
│ extract_trails_xls.py│  Python script
│ (Index + Sheets)     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ exported_data/       │  JSON output
│ trails.json          │
│ trail_details.json   │
│ lookup.json          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ match_schedule.py    │  Python script
│ (Schedule matching)  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ exported_data/       │  Updated JSON
│ trails.json          │  (with scores)
│ schedule.json        │  (generated, with trail_ids)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ hiker-app/public/    │  Copy to app
│ data/*.json          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ npm run build        │  Vite production build
│ (singlefile plugin)  │  Embeds JSON into HTML
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ dist/index.html      │  Single standalone file
│ (~582KB)             │
└──────────────────────┘
```

### Runtime Data Flow

```
App Start
    │
    ├── useTrailStore initializes IndexedDB (hiker-trails)
    │   │
    │   ├── DB empty? → Seed from embedded data
    │   └── DB has data? → Smart merge:
    │       ├── Add new trails from embedded data
    │       └── Preserve existing trail edits
    │
    ├── useTrails reads from IndexedDB via useTrailStore
    ├── useTrailDetails reads from IndexedDB via useTrailStore
    ├── schedule.json → useTrails hook (embedded, static reference)
    └── lookup.json → reference data (embedded, static reference)
```

## Component Architecture

### Pages

| Component | Path | Purpose |
|-----------|------|---------|
| Home | `src/pages/Home.jsx` | Landing page with trail grid, filters, links to Trail Manager |
| TrailDetail | `src/pages/TrailDetail.jsx` | Full trail info with edit capability, persists to IndexedDB |
| TrailManager | `src/pages/TrailManager.jsx` | CRUD interface for trails with search, index numbers, import/export |
| ScheduleBuilder | `src/pages/ScheduleBuilder.jsx` | Two-panel drag-and-drop schedule builder |

### Components

| Component | Path | Purpose |
|-----------|------|---------|
| FilterPanel | `src/components/FilterPanel.jsx` | Filter by distance, elevation, difficulty, months |
| TrailCard | `src/components/TrailCard.jsx` | Trail summary card for grid |
| TrailList | `src/components/TrailList.jsx` | Responsive grid layout |

### Hooks

| Hook | Path | Purpose |
|------|------|---------|
| useTrailStore | `src/hooks/useTrailStore.js` | IndexedDB CRUD operations with smart merge on seed |
| useTrails | `src/hooks/useTrails.js` | Read trail data from IndexedDB via useTrailStore |
| useTrailDetails | `src/hooks/useTrailDetails.js` | Read trail details from IndexedDB via useTrailStore |
| useFilters | `src/hooks/useTrails.js` | Shared filter state and sorting (co-located with `useTrails`) |

### Utilities

| Module | Path | Purpose |
|--------|------|---------|
| filterTrails | `src/utils/filterTrails.js` | Shared filter and sort logic (browse + schedule) |
| formatTrail | `src/utils/formatTrail.js` | Shared trail formatting |
| constants | `src/utils/constants.js` | Shared constants (months, difficulties, etc.) |
| report | `src/utils/report.js` | Report generation utilities |
| data | `src/utils/data.js` | Trail details access |

## Storage Strategy

### Embedded Data (Production)

JSON data is embedded directly into the HTML file at build time via a custom Vite plugin (`vite.config.js`). This enables:
- Zero server requirements
- Works from `file://` protocol
- Single file deployment

### IndexedDB (Trail Data)

Trail data and edits are stored in IndexedDB (`hiker-trails` database) with two object stores:
- `trails` (keyPath: `id`) — Main trail records
- `details` (keyPath: `id`) — Extended trail details

**Smart Merge on Seed:** On app load, embedded data is merged with IndexedDB:
- New trails from embedded data are added to the database
- Existing trail edits in IndexedDB are preserved
- This allows rebuilding the app without losing user edits

### localStorage Keys

| Key | Content |
|-----|---------|
| `hiker-schedule` | Per-month schedule: `{ "June": { 3: { trail_id: "elwha", hike: "Elwha Delta" }, 5: { trail_id: "mt-townsend", hike: "Mt. Townsend" } } }` |
| `hiker-schedule-debug` | Debug mode toggle (`true`/`false`) |

### Export Formats

| Format | File | Purpose |
|--------|------|---------|
| `trail-data-export.json` | Full backup for app import | `{ trails: { trails: [...] }, trailDetails: {...} }` |
| `export_for_excel.json` | Python script input | `{ trails: [...], trail_details: {...} }` |

### Schedule Data Structure

```json
{
  "June": {
    "3": { "trail_id": "elwha", "hike": "Elwha Delta (Place Road )" },
    "5": { "trail_id": "mt-townsend", "hike": "Mt. Townsend" },
    "10": { "trail_id": "lovers-lane", "hike": "Lovers Lane" }
  },
  "July": {
    "1": { "trail_id": "deer-park", "hike": "Deer Park" }
  }
}
```

## Routing Strategy

### MemoryRouter (file:// protocol)

The app uses `MemoryRouter` instead of `BrowserRouter` to work with `file://` protocol. This avoids:
- CORS issues with file://
- 404 errors on page refresh
- Server-side routing requirements

### URL Structure

| Route | Page |
|-------|------|
| `/` | Home |
| `/trail/:id` | Trail detail |
| `/trails` | Trail Manager (CRUD) |
| `/schedule` | Schedule Builder |

## Build Pipeline

### Vite Configuration

```javascript
// vite.config.js
export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),  // Inline assets
    {
      name: 'embed-json-data',  // Custom: reads public/data/*.json, injects window.__EMBEDDED_DATA__
      transformIndexHtml() { ... }
    }
  ]
})
```

### Custom JSON Embed Plugin

1. Reads `public/data/*.json` files at build time
2. Serializes them into a JavaScript object
3. Injects `window.__EMBEDDED_DATA__` before app initialization
4. Singlefile plugin inlines all JS/CSS into the HTML

### Build Output

| File | Size | Description |
|------|------|-------------|
| `dist/index.html` | ~582KB | Single standalone HTML file with embedded JS, CSS, and data |

### Test Suite

| Metric | Count |
|--------|-------|
| Test Files | 13 |
| Tests | 157 |
| Framework | Vitest + jsdom + testing-library |

## Data Models

### Trail

```json
{
  "id": "anderson",
  "name": "And_Lk_TR",
  "fullName": "Anderson Lake State Park",
  "distance": 5,
  "distanceExtended": 7.1,
  "elevationStart": 250,
  "elevationMax": 600,
  "difficulty": "Easy to Mod",
  "parking": "Discover",
  "range": "30",
  "notes": "Anderson Lake State Park",
  "seasonal": {
    "Jan": 0, "Feb": 0, "Mar": 0, "Apr": 2,
    "May": 0, "Jun": 2, "Jul": 2, "Aug": 0,
    "Sep": 0, "Oct": 0, "Nov": 0, "Dec": 6
  },
  "difficultyOrder": 2
}
```

### Month Score System

```
score = base + (hike_count * 2)
capped at 9

base = 1 if trail has quarters in Excel
base = 0 if no quarters

hike_count = number of hikes in schedule for that month
```

### Schedule Entry

```json
{
  "day": 3,
  "hike": "Elwha Delta (Place Road )",
  "trail_id": "elwha"
}
```

### Lookup Reference Data

| Collection | Fields |
|------------|--------|
| difficulties | name, description, color |
| parkingLevels | name, description, color |
| months | name, abbreviation, season |

## Excel Data Structure

### Hike Data BaseM.xls

| Sheet | Content |
|-------|---------|
| Index | Trail overview (distance, elevation, difficulty, quarters) |
| [trail-name] | Individual trail details (parking, range, descriptions) |

### SOTHH schedule.xls

| Sheet | Content |
|-------|---------|
| 2Q22 Hikes | Hike schedule Q2 2022 |
| 3Q22 Hikes | Hike schedule Q3 2022 |
| ... | ... (17 quarters total, 2022-2026) |
| 2Q26 Hikes | Hike schedule Q2 2026 |

### Quarter Column Structures

The Index sheet has fixed quarter columns:
- Q1 (col H): Dec, Jan, Feb
- Q2 (col I): Mar, Apr, May
- Q3 (col L): Jun, Jul, Aug
- Q4 (col P): Sep, Oct, Nov

### Quarter Mapping

| Quarter | Months |
|---------|--------|
| Q1 | Dec, Jan, Feb |
| Q2 | Mar, Apr, May |
| Q3 | Jun, Jul, Aug |
| Q4 | Sep, Oct, Nov |

## File Structure

```
D:\hiker\
├── Hike Data BaseM.xls        # Source trail database (NEVER committed)
├── SOTHH schedule.xls          # Source hike schedule (NEVER committed)
├── README.md                   # User documentation
├── ARCHITECTURE.md             # This file
├── USAGE.md                    # Usage guide
├── extract_trails_xls.py       # Excel extraction script
├── match_schedule.py           # Schedule matching script
├── export_to_xls.py            # JSON → Excel export script
├── exported_data/              # Extracted JSON data (NEVER committed)
│   ├── trails.json             # Main trail database
│   ├── trail_details.json      # Extended trail info
│   ├── lookup.json             # Reference data
│   └── schedule.json           # Schedule hikes with trail IDs
└── hiker-app/                  # React application
    ├── public/
    │   └── data/               # JSON data files (pre-build)
    │       ├── trails.json
    │       ├── trail_details.json
    │       ├── lookup.json
    │       └── schedule.json
    ├── src/
    │   ├── App.jsx             # Root component (MemoryRouter)
    │   ├── main.jsx            # Entry point
    │   ├── index.css           # Global styles
    │   ├── components/         # Reusable components
    │   │   ├── FilterPanel.jsx
    │   │   ├── TrailCard.jsx
    │   │   └── TrailList.jsx
    │   ├── pages/              # Page components
    │   │   ├── Home.jsx
    │   │   ├── TrailDetail.jsx
    │   │   ├── TrailManager.jsx
    │   │   └── ScheduleBuilder.jsx
    │   ├── hooks/              # Custom hooks
    │   │   ├── useTrailStore.js   # IndexedDB CRUD with smart merge
    │   │   ├── useTrails.js       # (also contains useFilters)
    │   │   └── useTrailDetails.js
    │   ├── utils/              # Utility functions
    │   │   ├── filterTrails.js
    │   │   ├── formatTrail.js
    │   │   ├── constants.js
    │   │   ├── report.js
    │   │   ├── data.js
    │   │   └── io.js             # File import/export utilities
    │   └── test/               # Test suite
    │       ├── setup.ts        # IndexedDB mock (fake-indexeddb)
    │       ├── utils/          # Utility tests
    │       ├── hooks/          # Hook tests
    │       ├── components/     # Component tests
    │       └── pages/          # Page tests
    ├── dist/                   # Production build
    │   └── index.html          # Single standalone file
    ├── vite.config.js          # Build configuration
    ├── package.json
    └── index.html              # HTML template
```

## Protocol Compatibility

| Protocol | Router | Data Source | CORS |
|----------|--------|-------------|------|
| `file://` | MemoryRouter | Embedded data | N/A |
| `http://` | MemoryRouter | Fetch from /data/ | Blocked |

`useTrailDetails` checks `window.location.protocol !== 'file:'` to decide between:
1. Embedded data (no fetch needed, file://)
2. Fetch from server (fails on file:// due to CORS)

`useTrails` checks `window.__EMBEDDED_DATA__` for embedded data, falling back to `fetch('/data/*.json')`.

## Performance Considerations

- **Single file deployment**: ~590KB total, gzips to ~145KB
- **No network requests at runtime**: All data embedded
- **IndexedDB storage**: ~50MB+ capacity, native browser persistence, works with `file://` protocol
- **Smart merge on seed**: Adds new trails from embedded data without losing user edits
- **MemoryRouter**: No hash or history API overhead
- **React 19**: Latest optimizations
- **Comprehensive test suite**: 157 tests across 13 files with IndexedDB mocks

## Security Considerations

- **No backend**: No server-side vulnerabilities
- **localStorage only**: No external data transmission
- **XSS prevention**: React auto-escapes content
- **No user authentication**: Local-only application
- **Data integrity**: Edits stored client-side only
