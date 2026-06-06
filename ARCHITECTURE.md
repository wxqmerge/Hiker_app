# Hiker Trail App — Architecture

## System Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Vite Dev   │     │  Express Server  │     │  exported_data/ │
│   Client     │◄───►│  (port 3000)     │     │  (*.json)       │
│   (5173)     │     │                  │     │                 │
└─────────────┘     └──────────────────┘     └─────────────────┘
                         │
                         ▼
                  JSON File System
```

- **Frontend**: React SPA with client-side routing (`BrowserRouter`)
- **Backend**: Express API serving trail data, schedule, and lookup reference data from `exported_data/`
- **Data Flow**: Excel → Python scripts → `exported_data/*.json` → API → Frontend
- **Write-back**: Trail edits, schedule assignments, and deletions persist to `exported_data/` via the API

In production, the Express server serves the static `dist/` frontend and falls back to `index.html` for client-side routing.

## State Management

### Shared Module State (Client)

The app uses a shared module-level state pattern via `useTrailStore.js`. This avoids prop-drilling and keeps state synchronized across all components:

```javascript
// useTrailStore.js — module-level singleton state
let _trails = [];           // Shared mutable array
let _trailDetails = {};     // Shared mutable object
let _loading = true;
let _lookup = null;
let _schedule = null;
let _subscribers = [];      // Effect-based subscribers

function notifySubscribers() {
  _subscribers.forEach(fn => fn());
}
```

Components subscribe via `useEffect` in `useTrailStore()`. When data changes (API write), `setState()` notifies all subscribers, triggering React re-renders.

**Lifecycle**: `initSharedState()` runs at module evaluation time, loading all data in parallel via `Promise.all`.

### Filter State

Filters use a similar shared state pattern in `useFilters.js`:

```javascript
let _filters = { ...DEFAULT_FILTERS };
let _subscribers = [];

export function useFilters(trails) {
  const { filters, setFilters, resetFilters } = useFiltersStore();
  const filteredTrails = useMemo(() => filterTrails(trails, filters), [trails, filters]);
  const sortedTrails = useMemo(() => sortTrails(filteredTrails, filters), [filteredTrails, filters]);
  return { filters, setFilters, sortedTrails, resetFilters };
}
```

The `useFilters` hook computes `filteredTrails` and `sortedTrails` via `useMemo`, deriving from the shared filter state and input trails.

### Schedule Store (ScheduleBuilder)

The ScheduleBuilder uses local component state (`useState`) for the schedule store, not the shared module state. This keeps schedule edits isolated from trail data:

```javascript
const [scheduleStore, setScheduleStore] = useState(() => ({}));
```

Changes are persisted via `updateMonthSchedule()` which uses functional state updates and broadcasts to subscribers.

## Component Hierarchy

```
App (BrowserRouter)
├── Home (/)
│   ├── FilterPanel
│   │   ├── Search input
│   │   ├── Distance/Elevation range sliders
│   │   ├── Difficulty toggle buttons
│   │   ├── Month toggle buttons
│   │   ├── Sort buttons (A-Z, Pop, Elev, Dist)
│   │   └── Wilderness toggle
│   └── TrailList
│       └── TrailCard (×N)
│           └── Copy Report button
├── TrailDetail (/trail/:id)
│   ├── Navigation bar (← Browse, Trail X of N, Prev/Next, Copy Report)
│   ├── Header (name, difficulty badge)
│   ├── Stats Grid (distance, elevation, parking, ride)
│   ├── Sections (description, notes, months, season, pros, others, leaders, altNames)
│   ├── Settings menu (gear icon — Export/Import)
│   └── Edit modal (pencil button)
│       ├── Basic info form
│       ├── Distance & elevation form
│       ├── Seasonal info form
│       └── Content form
├── TrailManager (/trails)
│   ├── Search input
│   ├── Action buttons (New, Export, Import, Export for Excel)
│   └── Table (index, name, distance, difficulty, actions)
└── ScheduleBuilder (/schedule)
    ├── Month selector dropdown
    ├── FilterPanel (reused)
    ├── Scheduled section (toggleable grid)
    ├── Available hikes panel (draggable)
    └── Date cards panel (drop targets)
```

## Hook Architecture

```
useTrailStore (shared state + API CRUD)
├── initSharedState() — loads all data on module eval
├── saveTrail() — PUT /api/trails/:id
├── saveTrailDetail() — PUT /api/trails/details/:id
├── deleteTrail() — DELETE /api/trails/:id
├── exportJSON() — returns { trails, trailDetails }
└── importJSON() — bulk PUT via API

useTrails (wrapper)
└── useTrailStore() → returns { trails, lookup, schedule, trailDetails, loading }

useTrailDetails (thin accessor)
└── useTrailStore() → returns trailDetails

useFilters (filter state + derived data)
├── useFiltersStore() — shared filter state + subscribers
├── filterTrails() — applies all filter criteria
└── sortTrails() — applies sort order
```

## Data Flow

### Initial Load

```
Module eval: initSharedState()
    │
    ├── Promise.all([
    │     api.getTrails()        → GET /api/trails
    │     api.getTrailDetails()  → GET /api/trails/details
    │     api.getLookup()        → GET /api/lookup
    │     api.getSchedule()      → GET /api/schedule
    │   ])
    │
    ├── setState(trails, details, false, lookup, schedule)
    │   │
    │   ├── _trails = trails
    │   ├── _trailDetails = details
    │   ├── _loading = false
    │   ├── _lookup = lookup
    │   ├── _schedule = schedule
    │   │
    │   └── notifySubscribers()  → all components re-render
    │
    └── useFilters(trails) computes filteredTrails + sortedTrails
```

### Trail Edit

```
User clicks pencil → Edit modal opens
User modifies fields → updateField() sets editedFields state
User clicks Save → saveEdits()
    │
    ├── build updatedTrail object
    │   └── api.updateTrail(trail) → PUT /api/trails/:id
    │
    ├── build updatedDetail object
    │   └── api.updateTrailDetail(id, detail) → PUT /api/trails/details/:id
    │
    └── setIsEditMode(false)
```

### Schedule Assignment

```
User drags hike card → handleDragStart(hikeIndex, null, hikeName)
    │
    └── setDragData({ hikeIndex, sourceDay, hikeName })

User drops on date → handleDropOnDate(targetDay)
    │
    ├── trailId = trailIndexToId[hikeIndex]
    │
    └── updateMonthSchedule(monthName, prev => {
            delete next[sourceDay]   // remove from old position
            next[targetDay] = { trail_id, hike }
        })
    │
    └── setScheduleStore(newStore) → re-renders
```

### Data Write-back (Server)

```
API PUT /api/trails/:id
    │
    ├── requireAdminKey middleware — validates X-API-Key via timingSafeEqual
    │
    ├── dataService.updateTrail(trail)
    │   ├── Find trail in memory array
    │   ├── Update in-place or push new
    │   └── writeWithHealth('trails.json', { trails })
    │       └── fs.writeFile(path, JSON.stringify(data, null, 2))
    │
    └── setState() notifies subscribers
```

## Shared Types System

```
shared/types/index.ts  (TypeScript interfaces)
         │
         ▼  scripts/compile-shared.js
    npx tsc (NodeNext module)
         │
         ▼  scripts/patch-shared-imports.js
    Patch relative imports: `.ts` → `.js`
         │
         ▼
shared/types/index.js   (compiled JS for Node)
shared/types/index.d.ts (type declarations)
```

The compile script creates a temp directory, copies `.ts` files, compiles with `npx tsc`, then copies `.js` output back. The patch script adds `.js` extensions to relative imports (required by Node ESM).

**Types exported**: `Trail`, `TrailDetail`, `ScheduleEntry`, `ScheduleData`, `LookupData`, `TrailsData`, `TrailDetailsData`, `ServerData`, `SeasonalData`.

## Server Architecture

### Express App Structure

```
server/src/index.ts
├── Middleware
│   ├── Request timing logger
│   ├── Rate limiter (2000 req / 15 min)
│   ├── CORS (configurable origins)
│   ├── Helmet (CSP, security headers)
│   └── JSON/URL body parsers (1mb limit)
│
├── Routes
│   ├── /api/trails — trails.routes.ts
│   ├── /api/schedule — schedule.routes.ts
│   └── /api/lookup — lookup.routes.ts
│
├── /health — GET health + write health status
│
└── Static serving (production only)
    ├── express.static('dist/')
    └── fallback to index.html (client-side routing)
```

### Middleware Pipeline

```
Request
    │
    ▼
Timing logger (adds duration to console.log)
    │
    ▼
Rate limiter (/api only) — 2000 req / 15 min
    │
    ▼
CORS — configurable origins, credentials, methods
    │
    ▼
Helmet — CSP (defaultSrc: self, scriptSrc: self, styleSrc: self + unsafe-inline)
    │
    ▼
Body parsers — JSON + URL-encoded (1mb each)
    │
    ▼
Route handler
```

### Auth Middleware

```typescript
requireAdminKey(req, res, next)
    │
    ├── Check ADMIN_API_KEY is configured
    ├── Read X-API-Key from headers
    ├── crypto.timingSafeEqual() — constant-time comparison
    │   └── Pads buffers to max length if sizes differ
    │
    └── Set req.role = 'admin'
```

### Data Service (`dataService.ts`)

```
loadData() — reads all JSON files from exported_data/
    ├── trails.json → Trail[]
    ├── trail_details.json → TrailDetailsData
    ├── lookup.json → LookupData
    └── schedule.json → ScheduleData

writeWithHealth(filePath, data) — atomic write with health tracking
    ├── fs.writeFile(path, JSON.stringify(data, null, 2))
    ├── Updates writeHealth: lastWriteTime, lastWriteSuccess, consecutiveFailures
    └── On error: records lastError, lastErrorTime, increments consecutiveFailures
```

### Route Handlers

**trails.routes.ts**:
```
GET  /api/trails          → { trails: getTrails() }
GET  /api/trails/:id      → getTrailById(id)
GET  /api/trails/details  → getTrailDetails()
GET  /api/trails/details/:id → getTrailDetailById(id)
PUT  /api/trails/:id      → requireAdminKey + updateTrail()
PUT  /api/trails/details/:id → requireAdminKey + updateTrailDetail()
DELETE /api/trails/:id    → requireAdminKey + deleteTrail()
```

**schedule.routes.ts**:
```
GET  /api/schedule              → getSchedule()
GET  /api/schedule/report       → Text report for quarter(s) (Q1=Dec/Jan/Feb, etc.)
GET  /api/schedule/download     → TSV download for quarter(s)
POST /api/schedule/upload       → requireAdminKey + multer file upload + TSV parse
```

**lookup.routes.ts**:
```
GET /api/lookup → getLookup()
```

## Vite Configuration

```javascript
// vite.config.js
{
  base: mode === 'production' ? (process.env.VITE_BASE || '/') : '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
  },
}
```

The dev server proxies `/api` and `/health` requests to the Express server (port 3000). In production, the Express server serves the static `dist/` build directly.

## API Client (`api/client.js`)

The API client is a plain JavaScript module (no TypeScript) that wraps `fetch`:

```javascript
getApiBase()
    │
    ├── Production: auto-detects from URL
    │   ├── Subdomain: sothh-dev.example.com → https://sothh-dev.example.com
    │   └── Path: example.com/sothh-dev → https://sothh-dev.example.com
    │
    └── Dev/Test: returns '' (relative paths for proxy/mock)
```

```javascript
request(path, options)
    │
    ├── Builds URL: `${getApiBase()}${path}`
    │   └── Sothh-dev: https://sothh-dev.example.com/api/trails
    │   └── Sothh-app: https://sothh-app.example.com/api/trails
    │   └── Dev: /api/trails → proxied to localhost:3000
    │
    ├── Sets headers: Content-Type + options.headers + X-API-Key (if apiKey option)
    │   └── X-API-Key from localStorage('hiker-api-key')
    │
    ├── Sends request with JSON body
    │
    └── On error: throws Error from JSON error response

getTrails(), getTrailById(id), updateTrail(trail), deleteTrail(id),
getTrailDetails(), getTrailDetailById(id), updateTrailDetail(id, detail),
getLookup(), getSchedule(), uploadSchedule(file),
getScheduleReport(quarter), getScheduleDownload(quarter)
```

**Critical**: All `fetch()` calls must go through `request()` or use `getApiBase()`. Never hardcode `/api/` paths — they resolve to wrong domains in multi-deployment setups.

## Utility Modules

### filterTrails.js — Core Filter/Sort Logic

Shared between browse and schedule views. Works on both trail objects and `{ trail, hike, hikeIndex }` wrapper objects.

```javascript
filterTrails(items, filters)
    │
    ├── Search: fuzzy match across hike name, trail name, fullName, notes,
    │          difficulty, and seasonal months
    ├── Distance: min/max range
    ├── Elevation: min/max range
    ├── Difficulty: inclusion check
    ├── Months: seasonal score > 0 check
    └── Wilderness: ◆ character in fullName

sortTrails(items, filters)
    │
    ├── name: localeCompare on fullName
    ├── popularity: sum of seasonal scores for selected months
    ├── elevation-up/down: elevationStart comparison
    ├── distance-up/down: distance comparison
    └── not-wilderness: ◆ presence, then name sort
```

### report.js — Report Generation

```javascript
generateReportText(trail, trailDetails)
    │
    ├── formatTrailLine(trail) — "Name◆︎  [Difficulty]\tdist/elev\tparking\tride-$X"
    │
    └── Append fullDescription (stripped of Pros/Others metadata)

getRideCost(range) — VBA-compatible formula:
    │
    ├── < 30 → ride-$3
    ├── < 60 → ride-$5
    ├── < 90 → ride-$7
    └── >= 90 → ride-$10
```

### data.js — Trail Detail Lookup

Handles ID mismatch fallback:
```javascript
getTrailDetailsById(details, trailId)
    │
    ├── Exact match: details[trailId]
    │
    └── Fallback: split trailId by '-', check base segment
        └── "360-rd" → "360"
```

### formatTrail.js — Trail Line Formatting

```javascript
formatTrailLine(trail)
    │
    ├── Strip ◆ characters from name
    ├── Format: "Name◆︎  [Difficulty]\tdist-dist'\-max'\tparking\tride-$X"
    └── Tab-separated for TSV export
```

### io.js — File I/O

```javascript
downloadBlob(data, filename, type)
    │
    └── Blob → URL.createObjectURL → <a download> → revoke

createImportFileInput(onImport, onError)
    │
    └── Create hidden <input type="file"> → FileReader → JSON.parse → callback
```

### constants.js

```javascript
MONTH_NAMES — 12 full month names
MONTH_ABBR — 12 abbreviations
DAY_NAMES — 7 day names
DEFAULT_FILTERS — { search, distanceMin/Max, elevationMin/Max, difficulties, months, sortBy, wilderness }
DIFFICULTY_COLORS — Map of difficulty → Tailwind bg/text classes
```

## Test Architecture

```
src/test/
├── setup.ts            — fake-indexeddb mock
├── utils/              — Tests for filterTrails, formatTrail, report, data, constants, io
├── hooks/              — Tests for useFilters
├── components/         — Tests for FilterPanel, TrailCard, TrailList
└── pages/              — Tests for Home, TrailDetail, ScheduleBuilder
```

- Framework: Vitest 4 + jsdom + testing-library
- Coverage: V8 provider (text + lcov reporters)
- IndexedDB: Mocked via `fake-indexeddb` in `setup.ts`

## Build Pipeline

```
npm run build:all
    │
    ├── npm run build (Vite)
    │   ├── React compilation (@vitejs/plugin-react)
    │   ├── Tailwind CSS processing
    │   ├── Output to dist/
    │   └── Base URL: / (production, path-agnostic)
    │
    └── npm run build:server (TypeScript)
        ├── tsc (server/tsconfig.json)
        ├── Output to server/dist/
        └── scripts/flatten-server-dist.js (handles nested output)
```

## Deployment Modes

### Dev Mode
```
Vite (5173) — static files + HMR
    └── proxy /api → localhost:3000
    └── proxy /health → localhost:3000

Express (3000) — API server
    └── serves /api/*, /health
    └── reads/writes exported_data/
    └── proxy mode: forwards to Vite for non-API routes
```

### Production Mode
```
Express (PORT) — single process
    ├── serves /api/*, /health
    ├── serves static dist/ files
    └── fallback: send index.html for client-side routing

    reads/writes exported_data/
```

### Nginx Reverse Proxy
```
/<SUBDOMAIN>/ → alias to frontend (SOTHH app)
/api/* → not proxied; client calls subdomain directly
/health → not proxied; client calls subdomain directly
```

Nginx serves only static files. Each deployment calls its Express backend directly via its own subdomain. No API proxying needed.

### Multi-Deployment Architecture
```
example.com/sothh-app → dist/ → Express port 29969 (https://sothh-app.example.com)
example.com/sothh-dev → dist/ → Express port 29967 (https://sothh-dev.example.com)
sothh-app.example.com → dist/ → Express port 29969
sothh-dev.example.com → dist/ → Express port 29967
```

The client auto-detects which subdomain to call based on the current URL path or hostname.
