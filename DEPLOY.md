# Deployment Guide - Hike Database Web App

This app is **not static**: an Express server (`server/`) reads/writes JSON files in
`exported_data/` and serves the built SPA from `dist/`. The server is the source of
truth — the client has no local persistence.

---

## Production Deploy (Ubuntu + nginx)

Nginx proxies each subdomain to its Node service (see
`deploy/nginx/subdomain.conf.template`); Express serves `dist/` and the `/api`
routes with helmet CSP headers.

```bash
# First-time setup (users, systemd units, env files): run deploy/hiker-env.sh steps
# Ongoing update (build + restart, runs as the deploy user):
./deploy/update.sh [service-name] [--force|--force-critical]

# Version management / rollback helpers: deploy/manage_versions.sh
```

Per deployment (sothh, ramblers, …) the server reads root `.env`
(`ADMIN_API_KEY`, `SCHEDULE_NAME`, `HIKE_DAYS`, `MAX_HIKES_PER_DAY`, `PORT`, …).
`server/.env` is ignored — local only, never committed. With `TRUST_PROXY=0` the
server stops trusting `X-Forwarded-For` (only set it when Node is exposed
directly, i.e. no nginx in front).

## Quick Local Test

```bash
npm run dev:all        # Vite (5173) + Express (3000)
npm run build:all      # client dist/ + server build
npm run test:all
npm run lint
```

---

## Updating Data After Deploy

The Excel pipeline lives at the repo root (see AGENTS.md):

```bash
python D:\projects\hiker\extract_trails_xls.py   # Excel → exported_data/*.json
python D:\projects\hiker\match_schedule.py       # schedule scores
```

Copy the resulting `exported_data/*.json` to the server and restart, or push them
through the admin API (`POST /api/data/import-zip`). There is no client-side cache
of trail data; edits live in `exported_data/` on the server.

### To export trail data to Excel:

1. In Trail Manager (`/trails`), click "Export for Excel"
2. Run `python D:\projects\hiker\export_to_xls.py` to convert `export_for_excel.json` back to Excel format

---

## Troubleshooting

### Data not loading
- Check the server process (`systemctl status hiker-*`) and `[API]` request logs.
- Verify the JSON files in `exported_data/` on the server.

### Filters not working
- Clear browser cache / service worker (the SW uses network-first for API reads).

### Schedule Builder issues
- Schedule state is server-side; check `GET /api/schedule` returns the expected JSON.
- A 412 on save means another editor changed the schedule first — the app
  reloads the latest version automatically.

---

## Build Pipeline

```
Excel Files → extract_trails_xls.py → exported_data/*.json
              ↓
match_schedule.py → updated trails.json + schedule.json
              ↓
npm run build:all → dist/ (client) + server build
              ↓
deploy/update.sh → systemd restart → nginx serves /<SUBDOMAIN>/
```
