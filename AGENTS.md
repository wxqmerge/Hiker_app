# AGENTS.md

## Repo Layout
- `server/`: Express/TS API server.
- `shared/types/`: Shared TypeScript types.
- `scripts/`: Build/patch scripts.
- `deploy/`: Deployment and verification scripts.
- `exported_data/`: JSON data (never commit).
- **Never commit**: `*.xls*`, `exported_data/`, `node_modules/`, `dist/`, `server/dist/`.

## Core Architecture
- **Single Server**: Express serves `/api/*` and `/health`.
- **Production Routing (Nginx)**:
  - Frontend served via `<DOMAIN>/<SUBDOMAIN>/` (using `alias`).
  - API and health checks proxied to Express (port `<PORT>` in prod).
  - Supports both `<SUBDOMAIN>.<DOMAIN>` and `<DOMAIN>`.
- **Data**: No client-side storage; all data is on server disk via API.

## Data Pipeline (Non-obvious)
1. Excel files in root (never commit).
2. `python extract_trails_xls.py` $\rightarrow$ `exported_data/*.json`.
3. `python match_schedule.py` $\rightarrow$ updates scores.
4. `npm run build:all` $\rightarrow$ builds `dist/` and `server/dist/`.

## Developer Commands
- `npm run dev:all`: Dev mode (Vite 5173 + Express 3000).
- `npm run build:all`: Production build.
- `npm run test:run`: Run all tests.
- `deploy/verify.sh`: Server-side integrity check.
- `deploy/test-external.ps1`: External smoke test (Windows/PowerShell).

## Deployment Gotchas
- **Nginx Config**: Uses `alias` for subpath `/<SUBDOMAIN>/`.
- **Port Mismatch**: Dev port is `3000`, but production port is `<PORT>`.
- **Hairpin NAT**: Server may not reach its own public domain; `verify.sh` uses `localhost` fallbacks.
- **SSL**: Managed via Certbot.

## Data & API Quirks
- **API Keys**: Write endpoints (`PUT`, `DELETE`, `POST`) require `X-API-Key`.
- **Month Scores**: `seasonal` is a dict `{ "Jan": 3, ... }`, not an array.
- **Excel Extraction**: Quarter column positions vary across 17 sheets.
- **Testing**: Uses `src/test/setup.ts` for mocks.
