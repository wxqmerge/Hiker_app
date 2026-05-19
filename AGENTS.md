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
5. `cd hiker-app && npm run build` → single `dist/index.html` (~525KB) with all data embedded

## Runtime data loading
- Uses **MemoryRouter** (not BrowserRouter) — required for `file://` protocol
- `useTrails()` checks `window.__EMBEDDED_DATA__` first (embedded mode), falls back to `fetch('/data/*.json')` (dev mode)
- The check is `if (window.__EMBEDDED_DATA__)` — it does NOT check protocol for embedded data
- `TrailDetail.jsx` and `Home.jsx` also check `window.location.protocol !== 'file:'` before fetching trail_details.json

## Edit persistence
- User edits stored in **localStorage** key `hiker-trail-edits`
- Structure: `{ [trailId]: { description, notes, pros, others, leaders, distance, ... } }`
- `getEditedValue(field)` in TrailDetail.jsx returns edited value or falls back to original
- "Export Merged Data" button on Home page merges edits into JSON and downloads files
- After export, localStorage is cleared

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
- No test or typecheck scripts exist

## Routing (App.jsx)
- `/` → Home (browse page with filters)
- `/trail/:id` → TrailDetail
- Browse is NOT a separate route — it's the Home page with filters

## Excel extraction quirks
- Quarter column positions vary across 17 sheets (5, 6, 7, 10, 11, 15 columns)
- Q1=Dec/Jan/Feb, Q2=Mar/Apr/May, Q3=Jun/Jul/Aug, Q4=Sep/Oct/Nov
