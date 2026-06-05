# SOTHH Hike Scheduler — Usage Guide

## Getting Started

**With Server (Recommended):** Run `npm run dev:all` to start Vite (port 5173) and Express API server (port 3000) simultaneously. The app connects to the API server for trail data.

**Without Server:** The app can also load static JSON files directly from `public/data/` if no API server is running.

## Browse Trails

The default view shows all trails. Use the filters at the top to narrow the list:

- **Search** — matches trail name, hike name, full name, notes, parking, difficulty, and seasonal months
- **Distance** — range slider (0–20 mi)
- **Elevation** — range slider (0–5000 ft)
- **Difficulty** — click to select one or more levels (Easy, Easy to Mod, Moderate, Mod to Diff, Difficult)
- **Months** — click month abbreviations (Jan–Dec) to filter by seasonal availability
- **Sort** — A-Z, Pop (popularity), Elev ↑/↓, Dist ↑/↓
- **Wilderness** — toggle ◆ to show only wilderness trails

Click any trail card to see its full details (description, pros, cons, leader info, alternate names).

### Trail Card Info

Each card displays:
- Full trail name (e.g., "Heart of the Forest")
- Difficulty badge (color-coded: green/lime/yellow/orange/red)
- Distance with extended option (e.g., "5.0 mi / 5.5 mi")
- Elevation range (e.g., "650' - 850'")
- Parking type (Discover, Nat'l Park/Golden, N/A, etc.)
- Ride cost (e.g., "ride-$5") or range value
- Available months (if seasonal)
- Best season (if specified)

### Editing Trail Data

Click the **green pencil button** (bottom-right floating button) on the trail detail page to enter edit mode. Editable fields include:

**Basic Information:**
- Full Name, Difficulty, Parking, Range

**Distance & Elevation:**
- Distance (miles), Distance Max (miles)
- Elevation Gain min (ft), Elevation Max (ft)

**Seasonal Information:**
- Best Season (dropdown: All, Spring, Summer, Fall, Winter, and combinations)
- Available Months (checkboxes for Jan–Dec)

**Trail Content:**
- Description, Notes, Pros, Others
- Trail Leaders (comma-separated)
- Alternate Names (comma-separated)

Changes are saved to the API server immediately. An "EDITED" badge appears on the trail header while in edit mode.

### Copy Report

Click **Copy Report** on the trail detail page or on any trail card to copy a formatted text report:

```
Trail Name◆︎  [Difficulty]    distance / elevation    parking    ride-$X
Full description text...
```

Ride cost is calculated from the range value:
- < 30 min = ride-$3
- 30-59 min = ride-$5
- 60-89 min = ride-$7
- >= 90 min = ride-$10

## Trail Manager

Navigate to **Trail Manager** (`/trails`) to:
- **View** all trails in a table with index numbers, distance, difficulty, and trail ID
- **Search** by trail name, full name, or ID
- **Add** new trails with the "New Trail" button (generates ID from name)
- **Edit** trails (click the edit icon to navigate to the trail detail page)
- **Delete** trails with confirmation dialog
- **Export JSON** — Downloads trail data as JSON for backup
- **Import JSON** — Imports trail data from a JSON file
- **Export for Excel** — Generates `export_for_excel.json` for Python scripts
- **API Key** — Set the admin API key for server-side operations

To set the API key: enter it in the "API Key" field and click "Save Key". The key is stored in localStorage.

## Schedule Builder

Navigate to **Schedule Builder** (`/schedule`) to plan hikes for upcoming months.

### Layout

The Schedule Builder has two panels:

- **Left panel** — Available hikes (trails not yet assigned to any date, filterable with same filters as browse)
- **Right panel** — Wed/Fri dates for the selected month (year is 2026)

### Creating a Schedule

1. **Select a month** using the dropdown at the top (shows hike count per month)
2. **Filter hikes** (optional) — same filters as browse mode
3. **Drag a hike** from the left panel and **drop it on a date** in the right panel
4. To **unassign** a hike, drag it back to the left panel, or click the **X** button on a date card
5. To **reschedule**, drag a hike from one date to another

### Scheduled Hikes Section

Click the **Scheduled (N)** button to show all currently assigned hikes in a grid. These cards are also draggable — drag them to a different date to reschedule. Each scheduled card shows a day-number badge (e.g., "3 W" for Wednesday the 3rd).

### Per-Month Schedules

Each month has its own independent schedule. Switching months shows that month's dates and assignments. Schedules are stored in the app's shared state.

### Exporting a Schedule

Click **Export to Text File** at the bottom to generate a `.txt` file for the current month:

```
Over-the-Hill Hike Descriptions -- June, 2026
Wednesday, June 6    Trail Name◆︎  [Difficulty]    distance / elevation    parking    ride-$X
Full description...

Friday, June 5       TBD
```

Unassigned dates show "TBD".

### Import/Export All Data

Click the **gear icon** in the top bar to access:

- **Export Schedule** — Downloads current schedule data as JSON
- **Export Hike Edits** — Downloads trail edits as JSON
- **Import Hike Edits** — Imports trail edits from a JSON file
- **Import** — Imports schedule data from a JSON file (merged with existing)
- **Debug Mode** — Toggle to show hike index badges on cards and detailed console logging
- **Clear All Data** — Removes all schedule assignments

### Debug Mode

Enable **Debug Mode** from the gear menu to see:
- Hike index numbers on cards (left panel and scheduled section)
- Detailed console logging when you type in the search box (shows trail count, filtered count, sorted count)

## Data Persistence

All data is stored on the API server in the `exported_data/` directory:

| File | Content |
|------|---------|
| `trails.json` | Trail database (all trails with edits) |
| `trail_details.json` | Extended trail info (descriptions, leaders, pros, others) |
| `schedule.json` | Per-month schedule data |
| `lookup.json` | Reference data (difficulties, parking levels) |

Changes made through the app (edits, deletes, schedule assignments) are written to these files via the API server.

## API Endpoints

The Express server provides the following API endpoints:

### Trails (`/api/trails`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/trails` | No | Get all trails |
| GET | `/api/trails/:id` | No | Get single trail |
| GET | `/api/trails/details` | No | Get all trail details |
| GET | `/api/trails/details/:id` | No | Get single trail detail |
| PUT | `/api/trails/:id` | Admin Key | Update trail |
| PUT | `/api/trails/details/:id` | Admin Key | Update trail detail |
| DELETE | `/api/trails/:id` | Admin Key | Delete trail |

### Schedule (`/api/schedule`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/schedule` | No | Get all schedule data |
| GET | `/api/schedule/report?quarter=Q1` | No | Get quarter report (text) |
| GET | `/api/schedule/download?quarter=Q1` | No | Download quarter schedule (TSV) |
| POST | `/api/schedule/upload` | Admin Key | Upload schedule from TSV file |

### Lookup (`/api/lookup`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/lookup` | No | Get reference data (difficulties, parking levels) |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health with write health status |

**Authentication:** Write endpoints (PUT, DELETE, POST) require an `X-API-Key` header. The API key is set in Trail Manager or stored in localStorage under `hiker-api-key`.

## Server Configuration

The server reads from `exported_data/` directory. Key environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment (production enables static file serving) |
| `ADMIN_API_KEY` | (none) | Admin API key for write operations |
| `CORS_ORIGINS` | `*` | Comma-separated CORS origins |

In production mode, the server serves the static `dist/` frontend and falls back to `index.html` for client-side routing.

## Routing

| Route | Page |
|-------|------|
| `/` | Browse Trails (Home) |
| `/trail/:id` | Trail Detail |
| `/trails` | Trail Manager |
| `/schedule` | Schedule Builder |

## Data Pipeline

1. Excel files in root directory (never commit)
2. `python extract_trails_xls.py` → `exported_data/*.json`
3. `python match_schedule.py` → updates schedule scores
4. `npm run build:all` → builds `dist/` and `server/dist/`

## Technical Notes

- The app uses **BrowserRouter** with BASE_URL support
- Drag and drop uses the native HTML5 API (no external libraries)
- Wed/Fri dates are computed automatically from the selected month (year: 2026)
- Each hike replaces any existing assignment on a date (no conflicts)
- Trail IDs are slugified from names (e.g., "Heart of the Forest" → "heart-of-the-forest")
- The app supports fallback trail lookups (e.g., "360-rd" matches "360")
- Alternate names allow schedule hikes to match trails by different names
- Server includes rate limiting (2000 req/15min), CORS, helmet security headers
