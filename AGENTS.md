# AGENTS.md

## Repo layout
- Root: React app (Vite 8, React 19, Tailwind 4), Express server, Python extraction scripts
- `server/` — Express/TS/ESM API server
- `shared/types/` — Shared TypeScript types
- `scripts/` — Build scripts (compile-shared, patch, flatten)
- `exported_data/` — JSON data files (never committed)
- **Never commit** `*.xls*`, `exported_data/`, `node_modules/`, `dist/`, `server/dist/`

## Architecture: Single server
- One Express server on port 3000 serves both `/api/*` endpoints and static `dist/` files
- Dev mode: Express proxies non-API requests to Vite (port 5173) for HMR
- Prod mode: Express serves built `dist/` directly
- No IndexedDB, no localStorage — all data on server disk via API

## Data pipeline (non-obvious — read first)
1. Excel files live in `D:\hiker\`. They are **never committed**.
2. Run `python extract_trails_xls.py` → writes `exported_data/trails.json`, `trail_details.json`, `lookup.json`
3. Run `python match_schedule.py` → updates `exported_data/trails.json` with month scores
4. `npm run build:all` → builds frontend `dist/` + server `server/dist/`
5. Server reads from `exported_data/*.json` at startup, writes updates back to disk

## Runtime data loading
- Uses **BrowserRouter** (not MemoryRouter) — server handles all routes
- `useTrailStore()` fetches data via `src/api/client.js` → Express API
- All CRUD goes through API: `GET /api/trails`, `PUT /api/trails/:id`, etc.
- Schedule state stored on server, persisted to `exported_data/schedule.json`

## API endpoints
- `GET /health` — health check with write health status
- `GET /api/trails` — all trails
- `GET /api/trails/details` — all trail details
- `PUT /api/trails/:id` — update trail
- `PUT /api/trails/:id/details` — update trail detail
- `DELETE /api/trails/:id` — delete trail
- `GET /api/schedule` — schedule data
- `POST /api/schedule/upload` — TSV upload (auto-detects quarter)
- `GET /api/schedule/report` — schedule report
- `GET /api/schedule/download` — schedule download
- `GET /api/lookup` — lookup reference data
- Write endpoints require `X-API-Key` header (timing-safe comparison)

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
- Dev (both): `npm run dev:all` — starts Vite (5173) + Express (3000), Express proxies to Vite
- Dev (frontend only): `npm run dev`
- Dev (server only): `npm run dev:server`
- Build (both): `npm run build:all` — builds frontend `dist/` + server `server/dist/`
- Build (frontend): `npm run build`
- Build (server): `npm run build:server`
- Lint: `npm run lint`
- Preview: `npm run preview`
- Test: `npm run test:run` (157 tests, fetch mocks in `src/test/setup.ts`)
- Prod: `node server/dist/index.js` (set `NODE_ENV=production` in `server/.env`)

## Routing (App.jsx)
- `/` → Home (browse page with filters)
- `/trail/:id` → TrailDetail
- `/trails` → TrailManager (CRUD interface)
- `/schedule` → ScheduleBuilder
- Browse is NOT a separate route — it's the Home page with filters

## Deployment
- `deploy/update.sh` — 11-step deploy with cooldowns (certbot SSL, server + frontend + nginx + service)
- `deploy/verify.sh` — verifies server, frontend, nginx, service, SSL, HTTPS health
- `deploy/hiker.conf` — nginx config: HTTP→HTTPS redirect, HTTPS proxies all to Express
- `deploy/test-external.ps1` — PowerShell script to test external interfaces (uses `curl.exe -k`)
- Certbot: `certbot --nginx -d sothh_app.example.com` manages SSL cert
- Deploy target: `/var/www/html/sothh_app`, service name `sothh_app`
- `server/.env` has `ADMIN_API_KEY` (gitignored, use `server/.env.example` as template)

## Excel extraction quirks
- Quarter column positions vary across 17 sheets (5, 6, 7, 10, 11, 15 columns)
- Q1=Dec/Jan/Feb, Q2=Mar/Apr/May, Q3=Jun/Jul/Aug, Q4=Sep/Oct/Nov
