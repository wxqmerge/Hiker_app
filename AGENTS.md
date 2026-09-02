# AGENTS.md

## Repo Layout
- `server/`: Express/TS API server (reads/writes `exported_data/` JSON files)
- `shared/types/`: Shared TypeScript interfaces, compiled to JS via `scripts/compile-shared.js`
- `scripts/`: Build helpers (`compile-shared.js`, `patch-shared-imports.js`, `flatten-server-dist.js`)
- `deploy/`: Deployment scripts (never commit)
- `exported_data/`: Server-side JSON data (never commit)
- **Never commit**: `*.xls*`, `exported_data/`, `node_modules/`, `dist/`, `server/dist/`, `deploy/.env`, `deploy/hiker.conf`, `server/.env`

## Commands
```
npm run dev:all        # Vite (5173) + Express (3000) concurrently
npm run build:all      # Vite build + server TypeScript build
npm run test:run       # Run all tests (684 tests, ~5s)
npm run test:coverage  # Tests with V8 coverage
npm run lint           # ESLint on src/ only
```

## Architecture

### Data Flow
```
Excel → python extract_trails_xls.py → exported_data/*.json
      → python match_schedule.py     → schedule scores
      → npm run build:all            → dist/ + server/dist/
```

### State Management (Non-Obvious)
`useTrailStore.js` uses **module-level mutable state** (`_trails`, `_trailDetails`, etc.) with a subscriber pattern — not React context or Redux. `initSharedState()` runs at module evaluation time. Components subscribe via `useEffect`.

**Critical for tests**: Shared state persists across test files. Always call `resetFiltersStore()` in `beforeEach`. The test setup re-mocks `fetch` per test via `beforeEach`.

### Server Data Persistence
All writes go to `exported_data/` JSON files via `dataService.ts` — **not IndexedDB**. There is no client-side storage.

### Config (Server Is Source of Truth)
**Single build shared across deployments** (sothh, ramblers). The client does NOT read config from env vars at build time. Instead, the server exposes `/api/config` (`{ scheduleName, hikeDays, maxHikesPerDay }`) and the client fetches it at runtime. Server reads only root `.env` — `server/.env` is ignored (local-only, never committed).

**Full-week / multi-slot scheduling**: hikes can be scheduled on **any of the 7 days** with **up to `MAX_HIKES_PER_DAY` slots per day** (default `3`, slots A/B/C).
- `HIKE_DAYS` — comma-separated day-of-week numbers `0`–`6` (0=Sun). Repeat a day to give it multiple slots, e.g. `HIKE_DAYS=3,3,3` = Wednesday ×3. For all 7 days: `HIKE_DAYS=0,1,2,3,4,5,6`.
- `MAX_HIKES_PER_DAY` — integer `1`–`7` (default `3`). Caps the number of slots rendered per day-of-week and the `slot` index accepted at the API write boundary (`slot` 0..N-1).
- The data model is already multi-slot (`ScheduleEntry.slot` is an unbounded non-negative int); no migration needed. Existing groups (sothh `3,5`, ramblers `1,1`) are unaffected because their per-day count (≤2) is below the default cap.

### Shared Types Compilation
`server/package.json` build script runs 4 steps in order:
1. `compile-shared.js` — copies TS to temp dir, compiles with tsc
2. `npx tsc` — TypeScript compilation
3. `patch-shared-imports.js` — adds `.js` extensions to relative imports
4. `flatten-server-dist.js` — flattens nested output

## API Quirks
- Write endpoints (`PUT`, `DELETE`, `POST`) require `X-API-Key` header
- `seasonal` is a dict `{ "Jan": 3, ... }`, not an array
- `importJSON` accepts both `trailDetails` (camelCase) and `trail_details` (snake_case)
- Trail ID lookup falls back: `"360-rd"` → `"360"` (first segment)
- Schedule `findTrailById` uses 3-tier matching: exact → case-insensitive → slug word matching
- **API Base URL**: `getApiBase()` auto-detects from URL — subdomain (`sothh-dev.example.com`) or path (`example.com/sothh-dev`). All `fetch()` calls must use this or `request()` wrapper. Never hardcode `/api/` paths in production code.
- **`/api/config`**: Returns `{ scheduleName, hikeDays, maxHikesPerDay }` — client should not hardcode these values. `/api/schedule/group` returns the same three fields.

## Dev Server Gotchas
- Dev: Vite proxies `/api` and `/health` to `localhost:3000`
- Dev: Express proxies non-API routes to `localhost:5173` (Vite)
- Production: Express serves `dist/` static files and falls back to `index.html` for SPA routing
- Production port is `$PORT` env var (default 3000), not hardcoded

## Testing
- Vitest 4 + jsdom + testing-library
- Tests use `MemoryRouter` wrapping `BrowserRouter` (App uses `BrowserRouter`)
- Mock data in `src/test/setup.ts`: 3 trails (`trail-1`, `trail-2`, `trail-3`)
- `globalThis.__TEST_MOCK_DATA__` exposes mock data for test modifications
- ESLint ignores `server/`, `scripts/`, `shared/` — only lints `src/`

## Deployment
- Nginx uses `alias` for subpath `/<SUBDOMAIN>/` — **not** subdomain root. Access via `https://main-domain/<SUBDOMAIN>/`, NOT `https://<SUBDOMAIN>.main-domain/`
- Hairpin NAT: server may not reach its own public domain; use `localhost` fallbacks

## File Conventions
- F12 console logs are saved to `C:\Users\wxqme\Downloads\` with the pattern `<host>-<timestamp>.log` (e.g. `chess4.us-1788367055155.log`). When the user says "the log" or "the console log" without a specific filename, glob `C:\Users\wxqme\Downloads\*.log` and use the most recent one.
