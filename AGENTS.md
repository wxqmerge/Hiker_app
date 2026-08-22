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
**Single build shared across deployments** (sothh, ramblers). The client does NOT read config from env vars at build time. Instead, the server exposes `/api/config` (`{ scheduleName, hikeDays }`) and the client fetches it at runtime. Server reads only root `.env` — `server/.env` is ignored (local-only, never committed).

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
- **`/api/config`**: Returns `{ scheduleName, hikeDays }` — client should not hardcode these values.

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
