# AGENTS.md

## Repo layout
- `hiker-app/` — React app (Vite 8, React 19, Tailwind 4)
- Root: Excel source files + Python extraction scripts
- **Never commit** `*.xls*`, `exported_data/`, `node_modules/`, `dist/`

## Data pipeline (non-obvious — read first)
1. Excel files live in `D:\hiker\` (not in `hiker-app/`). They are **never committed**.
2. Run `python extract_trails_xls.py` → writes `exported_data/trails.json`, `trail_details.json`, `lookup.json`
3. Run `python match_schedule.py` → updates `exported_data/trails.json` with month scores
4. Copy JSON to `hiker-app/public/data/`
5. `cd hiker-app && npm run build` → single `dist/index.html` (~590KB) with all data embedded
6. **IndexedDB smart merge**: On app load, embedded data seeds IndexedDB. New trails are added; existing edits are preserved.

## Runtime data loading
- Uses **MemoryRouter** (not BrowserRouter) — required for `file://` protocol
- `useTrailStore()` initializes IndexedDB (`hiker-trails` DB) with smart merge from embedded data
- `useTrails()` reads from IndexedDB via `useTrailStore`
- `useTrailDetails()` reads from IndexedDB via `useTrailStore`
- `lookup` and `schedule` are static reference data from `window.__EMBEDDED_DATA__`

## Trail data persistence (IndexedDB)
- Trail data and edits stored in **IndexedDB** (`hiker-trails` database)
- Two object stores: `trails` (keyPath: `id`), `details` (keyPath: `id`)
- Smart merge on seed: New trails from embedded data are added; existing edits preserved
- `useTrailStore` provides CRUD: `saveTrail()`, `saveTrailDetail()`, `deleteTrail()`, `exportJSON()`, `importJSON()`
- Schedule state remains in **localStorage** (`hiker-schedule` key)

## Export formats
- **Export JSON** (`trail-data-export.json`): Full backup for app import
  - Format: `{ trails: { trails: [...] }, trailDetails: {...} }`
- **Export for Excel** (`export_for_excel.json`): Python script input
  - Format: `{ trails: [...], trail_details: {...} }`
- Run `python export_to_xls.py` to convert JSON back to Excel format

## Editable fields (all from TrailDetail.jsx `getEditedValue`)
- **trails.json fields**: `notes`, `fullName`, `distance`, `distanceExtended`, `elevationStart`, `elevationMax`, `difficulty`, `parking`, `range`, `bestSeason`, `parkingInfo`, `availableMonths`
- **trail_details.json fields**: `description`, `pros`, `others`, `leaders`

## Month score system
- `seasonal` is a dict `{ "Jan": 3, "Feb": 1, ... }` (not an array)
- Formula: `score = base + (hike_count * 2)`, capped at 9
- `base = 1` if trail has quarter data in Excel, `0` otherwise

## Commands
- Dev: `cd hiker-app && npm run dev`
- Build: `cd hiker-app && npm run build`
- Lint: `cd hiker-app && npm run lint`
- Preview: `cd hiker-app && npm run preview`
- Test: `cd hiker-app && npm run test:run` (157 tests, uses `fake-indexeddb` mock)

## Routing (App.jsx)
- `/` → Home (browse page with filters)
- `/trail/:id` → TrailDetail
- `/trails` → TrailManager (CRUD interface)
- `/schedule` → ScheduleBuilder
- Browse is NOT a separate route — it's the Home page with filters

## Excel extraction quirks
- Quarter column positions vary across 17 sheets (5, 6, 7, 10, 11, 15 columns)
- Q1=Dec/Jan/Feb, Q2=Mar/Apr/May, Q3=Jun/Jul/Aug, Q4=Sep/Oct/Nov
