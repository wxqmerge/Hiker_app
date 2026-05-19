# Hiker Trail Browser - Architecture

## Overview

A static React web application for browsing and managing SOTHH trail data. The app runs entirely in the browser with no backend server, using embedded JSON data and localStorage for persistence.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Build Tool | Vite 8 |
| Routing | React Router (MemoryRouter) |
| Styling | CSS Modules |
| Data Format | JSON |
| Source Data | Microsoft Excel (.xls) |
| Processing | Python 3 |

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
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │  │
│  │  │  Home    │  │  Browse  │  │  TrailDetail │   │  │
│  │  └──────────┘  └──────────┘  └──────────────┘   │  │
│  │                                                   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │  │
│  │  │  Search  │  │ Settings │  │  Schedule    │   │  │
│  │  └──────────┘  └──────────┘  └──────────────┘   │  │
│  │                                                   │  │
│  │  ┌───────────────────────────────────────────┐   │  │
│  │  │           Custom Hooks                    │   │  │
│  │  │  useTrails, useTrailDetail                │   │  │
│  │  └───────────────────────────────────────────┘   │  │
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
│ (~525KB)             │
└──────────────────────┘
```

### Runtime Data Flow

```
App Start
    │
    ├── Check for embedded data (window.__EMBEDDED_DATA__)
    │   ├── Present → Use embedded data (file:// protocol)
    │   └── Absent → Fetch from /data/*.json (http:// protocol)
    │
    ├── Load trails.json → useTrails hook → React state
    ├── Load trail_details.json → merge with trail data
    └── Load lookup.json → reference data (difficulty, parking, months)
```

## Component Architecture

### Pages

| Component | Path | Purpose |
|-----------|------|---------|
| Home | `src/pages/Home.jsx` | Landing page with quick actions, export button |
| Browse | `src/pages/Browse.jsx` | Trail grid with search and filters |
| TrailDetail | `src/pages/TrailDetail.jsx` | Full trail info with edit capability |
| Schedule | `src/pages/Schedule.jsx` | Schedule/hike data display |

### Components

| Component | Path | Purpose |
|-----------|------|---------|
| SearchBar | `src/components/SearchBar.jsx` | Unified search input |
| FilterPanel | `src/components/FilterPanel.jsx` | Filter by distance, elevation, difficulty, months |
| TrailCard | `src/components/TrailCard.jsx` | Trail summary card for grid |
| TrailGrid | `src/components/TrailGrid.jsx` | Responsive grid layout |
| MonthDots | `src/components/MonthDots.jsx` | Monthly availability visualization |
| EditModal | `src/components/EditModal.jsx` | Edit trail details form |
| SettingsMenu | `src/components/SettingsMenu.jsx` | Export/import/edit settings |
| ReportModal | `src/components/ReportModal.jsx` | Trail report generation |

### Hooks

| Hook | Path | Purpose |
|------|------|---------|
| useTrails | `src/hooks/useTrails.js` | Load, cache, and provide trail data |
| useTrailDetail | `src/hooks/useTrailDetail.js` | Get specific trail by ID with details |

### Utilities

| Module | Path | Purpose |
|--------|------|---------|
| trailUtils | `src/utils/trailUtils.js` | Fuzzy matching, score calculation, formatting |

## Storage Strategy

### Embedded Data (Production)

JSON data is embedded directly into the HTML file at build time via a custom Vite plugin (`vite.config.js`). This enables:
- Zero server requirements
- Works from `file://` protocol
- Single file deployment

### localStorage Keys

| Key | Content |
|-----|---------|
| `hiker-trail-edits` | User edits to trail details (description, notes, pros, others, leaders, stats) |
| `hiker-data-store` | Schedule data and month scores |

### Edit Data Structure

```json
{
  "trail-id": {
    "description": "edited description",
    "notes": "edited notes",
    "pros": "edited pros",
    "others": "edited others",
    "leader": "edited leader",
    "distance": 5.2,
    "elevation": 800,
    "difficulty": "Moderate"
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
| `/browse` | Browse trails |
| `/trail/:id` | Trail detail |
| `/schedule` | Schedule view |

## Build Pipeline

### Vite Configuration

```javascript
// vite.config.js
export default defineConfig({
  plugins: [
    react(),
    jsonEmbedPlugin(),  // Custom plugin
    singlefilePlugin()  // Inline assets
  ],
  build: {
    inlineDynamicImports: false,
    assetsInlineLimit: 0  // Inline everything
  }
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
| `dist/index.html` | ~525KB | Single standalone HTML file with embedded JS, CSS, and data |

## Data Models

### Trail

```json
{
  "id": "anderson",
  "name": "Anderson Lake",
  "fullName": "Anderson Lake State Park",
  "distance": 4.2,
  "elevation": 650,
  "difficulty": "Easy",
  "parking": "Level 3",
  "range": "0.0 - 4.2",
  "quarters": ["Q1", "Q2", "Q3", "Q4"],
  "seasonal": {
    "Jan": 6, "Feb": 1, "Mar": 1, "Apr": 2,
    "May": 0, "Jun": 2, "Jul": 2, "Aug": 0,
    "Sep": 0, "Oct": 0, "Nov": 0, "Dec": 3
  },
  "description": "...",
  "notes": "...",
  "pros": "...",
  "others": "...",
  "leader": "..."
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
| Q1 2022 | Hike schedule Q1 2022 |
| Q2 2022 | Hike schedule Q2 2022 |
| ... | ... (17 quarters total, 2022-2026) |
| Q4 2026 | Hike schedule Q4 2026 |

### Quarter Column Structures

The Excel file has 4 different column structures across quarters:
- 6 columns: basic schedule
- 9 columns: extended schedule
- 10 columns: with additional details
- 11 columns: full schedule

## File Structure

```
D:\hiker\
├── Hike Data BaseM.xls        # Source trail database
├── SOTHH schedule.xls          # Source hike schedule
├── README.md                   # User documentation
├── ARCHITECTURE.md             # This file
├── extract_trails_xls.py       # Excel extraction script
├── match_schedule.py           # Schedule matching script
├── exported_data/              # Extracted JSON data
│   ├── trails.json             # Main trail database
│   ├── trail_details.json      # Extended trail info
│   └── lookup.json             # Reference data
└── hiker-app/                  # React application
    ├── public/
    │   ├── data/               # JSON data files (pre-build)
    │   │   ├── trails.json
    │   │   ├── trail_details.json
    │   │   └── lookup.json
    │   └── favicon.ico
    ├── src/
    │   ├── App.jsx             # Root component (MemoryRouter)
    │   ├── main.jsx            # Entry point
    │   ├── index.css           # Global styles
    │   ├── components/         # Reusable components
    │   │   ├── SearchBar.jsx
    │   │   ├── FilterPanel.jsx
    │   │   ├── TrailCard.jsx
    │   │   ├── TrailGrid.jsx
    │   │   ├── MonthDots.jsx
    │   │   ├── EditModal.jsx
    │   │   ├── SettingsMenu.jsx
    │   │   └── ReportModal.jsx
    │   ├── pages/              # Page components
    │   │   ├── Home.jsx
    │   │   ├── Browse.jsx
    │   │   ├── TrailDetail.jsx
    │   │   └── Schedule.jsx
    │   ├── hooks/              # Custom hooks
    │   │   ├── useTrails.js
    │   │   └── useTrailDetail.js
    │   └── utils/              # Utility functions
    │       └── trailUtils.js
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

The app checks `window.location.protocol !== 'file:'` to decide between:
1. Embedded data (no fetch needed)
2. Fetch from server (fails on file:// due to CORS)

## Performance Considerations

- **Single file deployment**: ~525KB total, gzips to ~135KB
- **No network requests at runtime**: All data embedded
- **localStorage caching**: Edits persist across sessions
- **MemoryRouter**: No hash or history API overhead
- **React 19**: Latest optimizations

## Security Considerations

- **No backend**: No server-side vulnerabilities
- **localStorage only**: No external data transmission
- **XSS prevention**: React auto-escapes content
- **No user authentication**: Local-only application
- **Data integrity**: Edits stored client-side only
