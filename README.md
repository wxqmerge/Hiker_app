# Hike Database Web App

A React web application for browsing Olympic Peninsula hiking trail data, with a Schedule Builder for planning monthly hikes and a Trail Manager for CRUD operations.

## Tech Stack

- **Frontend**: React 19, Vite 8, React Router (BrowserRouter), Tailwind CSS 4
- **Backend**: Express/TypeScript, Helmet, CORS, express-rate-limit, multer
- **Data**: JSON files in `exported_data/`, shared TypeScript types
- **Testing**: Vitest 4, jsdom, testing-library, fake-indexeddb (~157 tests)
- **Shared Types**: `shared/types/` compiled via `scripts/compile-shared.js`

## Quick Start

```bash
npm install
npm run dev:all        # Vite (5173) + Express API (3000)
npm run build:all      # Production build
npm run test:run       # Run tests
```

See [USAGE.md](./USAGE.md) for end-user documentation.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Vite Dev   │     │  Express Server  │     │  exported_data/ │
│   Client     │◄───►│  (port 3000)     │     │  (*.json)       │
│   (5173)     │     │                  │     │                 │
└─────────────┘     └──────────────────┘     └─────────────────┘
                         │
                         ▼
                  API Endpoints
```

- **Frontend**: React SPA with client-side routing (`BrowserRouter`)
- **Backend**: Express API serving trail data, schedule data, and lookup reference data from `exported_data/`
- **Data Flow**: Excel → Python scripts → `exported_data/*.json` → API → Frontend
- **Write-back**: Trail edits, schedule assignments, and deletions are persisted to `exported_data/` via the API

## API Endpoints

### Trails (`/api/trails`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/trails` | — | Get all trails |
| GET | `/api/trails/:id` | — | Get single trail |
| GET | `/api/trails/details` | — | Get all trail details |
| GET | `/api/trails/details/:id` | — | Get single trail detail |
| PUT | `/api/trails/:id` | Admin Key | Update trail |
| PUT | `/api/trails/details/:id` | Admin Key | Update trail detail |
| DELETE | `/api/trails/:id` | Admin Key | Delete trail |

### Schedule (`/api/schedule`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/schedule` | — | Get all schedule data |
| GET | `/api/schedule/report?quarter=Q1` | — | Text report for quarter(s) |
| GET | `/api/schedule/download?quarter=Q1` | — | TSV download for quarter(s) |
| POST | `/api/schedule/upload` | Admin Key | Upload schedule from TSV |

### Lookup (`/api/lookup`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/lookup` | — | Reference data (difficulties, parking) |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health + write health status |

**Auth**: Write endpoints require `X-API-Key` header. Uses `crypto.timingSafeEqual` for secure comparison.

## Data Structure

### TypeScript Types

Shared types in `shared/types/index.ts` are compiled to `shared/types/index.js` and `shared/types/index.d.ts`.

### JSON Files (`exported_data/`)

**trails.json** — Array of trail objects:
```json
{
  "trails": [
    {
      "id": "360-rd",
      "name": "360 Rd",
      "fullName": "360 Road/Lookout Hill Rd.",
      "distance": 5.5,
      "distanceExtended": 6.0,
      "elevationStart": 575,
      "elevationMax": 934,
      "difficulty": "Easy",
      "parking": "Limited 2",
      "range": "76",
      "notes": "...",
      "seasonal": { "Jan": 0, "Feb": 0, "Mar": 1, ... },
      "difficultyOrder": 1
    }
  ]
}
```

**trail_details.json** — Dict keyed by trail ID:
```json
{
  "360-rd": {
    "fullDescription": "...",
    "pros": "...",
    "others": "...",
    "leaders": ["Pat", "Diane"]
  }
}
```

**schedule.json** — Dict keyed by month abbreviation:
```json
{
  "Jun": [
    { "day": 3, "hike": "Elwha Delta", "trail_id": "elwha" }
  ]
}
```

**lookup.json** — Reference data:
```json
{
  "difficulties": [
    { "code": "Easy", "order": 1, "label": "Easy" }
  ],
  "parkingLevels": {}
}
```

## Data Pipeline

1. Source Excel file (`Hike Data Base.xls`) — never commit
2. `python extract_trails_xls.py` → `exported_data/trails.json`, `trail_details.json`, `lookup.json`
3. `python match_schedule.py` → `exported_data/schedule.json` (matches schedule hikes to trail IDs)
4. `npm run build:all` → builds `dist/` and `server/dist/`

Quarter column positions vary across 17 Excel sheets.

## Development

### Prerequisites
- Node.js 16+

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite only (port 5173) |
| `npm run dev:server` | Express API only (port 3000) |
| `npm run dev:all` | Both Vite + Express with concurrently |
| `npm run build` | Vite build |
| `npm run build:server` | TypeScript compile server |
| `npm run build:all` | Full production build |
| `npm run test` | Vitest watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Tests with coverage |
| `npm run lint` | ESLint |

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | `production` serves static `dist/` |
| `ADMIN_API_KEY` | — | Admin key for write operations |
| `CORS_ORIGINS` | `*` | Comma-separated origins |

### Routing

| Route | Page |
|-------|------|
| `/` | Browse Trails |
| `/trail/:id` | Trail Detail |
| `/trails` | Trail Manager |
| `/schedule` | Schedule Builder |

## Testing

Tests use Vitest with jsdom and fake-indexeddb. Setup in `src/test/setup.ts` mocks IndexedDB.

```bash
npm run test:run
npm run test:coverage
```

## Deployment

### Production Build

```bash
npm run build:all
```

Outputs: `dist/` (frontend), `server/dist/` (compiled Express server).

### Vercel

Push to GitHub, import at vercel.com. Auto-configured via `vercel.json`.

### Netlify

Build command: `npm run build:all`, Publish: `dist`.

### Custom Server (Nginx + Express)

Nginx proxies `/<SUBDOMAIN>/` to frontend and `/api/*` to Express. See [DEPLOY.md](./DEPLOY.md) for details.

## Project Structure

```
├── public/
│   └── data/                  # Static JSON fallback (if no server)
├── server/
│   ├── src/
│   │   ├── index.ts           # Express app entry
│   │   ├── middleware/
│   │   │   └── auth.middleware.ts  # Admin API key validation
│   │   ├── routes/
│   │   │   ├── trails.routes.ts
│   │   │   ├── schedule.routes.ts
│   │   │   └── lookup.routes.ts
│   │   └── services/
│   │       └── dataService.ts     # JSON file read/write
│   ├── package.json
│   └── tsconfig.json
├── shared/
│   ├── types/
│   │   ├── index.ts           # Shared TypeScript interfaces
│   │   ├── index.js           # Compiled JS
│   │   └── index.d.ts         # Type declarations
│   └── tsconfig.json
├── scripts/
│   ├── compile-shared.js      # Compile shared types
│   ├── flatten-server-dist.js # Flatten server dist
│   └── patch-shared-imports.js # Fix shared imports
├── src/
│   ├── api/
│   │   └── client.js          # API client (fetch wrappers)
│   ├── components/
│   │   ├── FilterPanel.jsx    # Search/filter controls
│   │   ├── TrailCard.jsx      # Trail card component
│   │   └── TrailList.jsx      # Trail grid
│   ├── hooks/
│   │   ├── useTrailStore.js   # Shared state + API CRUD
│   │   ├── useTrails.js       # Data fetching wrapper
│   │   ├── useTrailDetails.js # Trail details accessor
│   │   └── useFilters.js      # Filter state + sorting
│   ├── pages/
│   │   ├── Home.jsx           # Browse trails
│   │   ├── TrailDetail.jsx    # Trail detail + edit modal
│   │   ├── TrailManager.jsx   # CRUD table view
│   │   └── ScheduleBuilder.jsx # Drag-and-drop schedule
│   ├── utils/
│   │   ├── constants.js       # MONTH_NAMES, DIFFICULTY_COLORS, etc.
│   │   ├── data.js            # Trail detail lookup with fallback
│   │   ├── filterTrails.js    # Core filter + sort logic
│   │   ├── formatTrail.js     # Trail line formatting
│   │   ├── io.js              # File download/import helpers
│   │   └── report.js          # Report generation + copy
│   ├── test/                  # Test suite
│   ├── App.jsx                # Router setup
│   ├── main.jsx               # Entry point
│   └── index.css              # Global styles
├── package.json
├── vite.config.js
├── vercel.json
├── USAGE.md                   # End-user documentation
├── DEPLOY.md                  # Deployment guide
└── ARCHITECTURE.md            # Architecture details
```

## License

MIT
