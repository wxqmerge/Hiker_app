# Fix: Startup too slow because of large GPX download

## Problem
`trails.json` is 100MB because it embeds ~96MB of GPX XML strings. The `/api/trails` endpoint returns all 100MB at app startup. GPX is only used when a user clicks "Share GPX" — completely unnecessary for initialization.

## Solution
Separate GPX data from trails. Store GPX filenames in a lightweight index, serve GPX files on-demand. Add compression and caching.

---

## File Changes

### 1. `shared/types/index.ts` — Replace `gpxData` with `hasGpx`

```diff
-  gpxData?: string;
+  hasGpx?: boolean;
```

### 2. `scripts/import-gpx-files.cjs` — Write gpx_index.json instead of embedding GPX

Replace the entire file with:

```javascript
const fs = require('fs');
const path = require('path');

const GPX_DIR = path.join(__dirname, '..', 'GPX');
const TRAILS_FILE = path.join(__dirname, '..', 'exported_data', 'trails.json');
const MATCHES_FILE = path.join(__dirname, 'gpx_matches.json');
const INDEX_FILE = path.join(__dirname, '..', 'exported_data', 'gpx_index.json');

const trailsData = JSON.parse(fs.readFileSync(TRAILS_FILE, 'utf-8'));
const matches = JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf-8'));

// Group matches by trail ID
const matchesByTrail = {};
for (const m of matches) {
  if (!matchesByTrail[m.trailId]) {
    matchesByTrail[m.trailId] = [];
  }
  matchesByTrail[m.trailId].push(m.gpxFile);
}

// Build gpx_index: trailId -> gpx filename
const gpxIndex = {};
let imported = 0, skipped = 0;

for (const [trailId, gpxFiles] of Object.entries(matchesByTrail)) {
  const trail = trailsData.trails.find(t => t.id === trailId);
  if (!trail) {
    console.log(`SKIP: Trail ${trailId} not found`);
    skipped++;
    continue;
  }

  // Pick the largest GPX file if multiple match
  let selectedFile = gpxFiles[0];
  if (gpxFiles.length > 1) {
    let maxSize = 0;
    for (const f of gpxFiles) {
      const size = fs.statSync(path.join(GPX_DIR, f)).size;
      if (size > maxSize) {
        maxSize = size;
        selectedFile = f;
      }
    }
  }

  // Validate file exists
  const gpxPath = path.join(GPX_DIR, selectedFile);
  if (!fs.existsSync(gpxPath)) {
    console.log(`SKIP: ${selectedFile} not found on disk`);
    skipped++;
    continue;
  }

  // Set hasGpx flag on trail, remove old gpxData
  trail.hasGpx = true;
  delete trail.gpxData;

  // Add to index
  gpxIndex[trailId] = selectedFile;
  imported++;
  console.log(`INDEX: ${trail.fullName} (${trailId}) ← ${selectedFile}`);
}

// Also clear gpxData from trails that already had it but aren't in matches
for (const trail of trailsData.trails) {
  if (trail.gpxData && !trail.hasGpx) {
    delete trail.gpxData;
  }
}

// Save updated trails (without embedded GPX)
fs.writeFileSync(TRAILS_FILE, JSON.stringify(trailsData, null, 2));

// Save gpx index
fs.writeFileSync(INDEX_FILE, JSON.stringify(gpxIndex, null, 2));

console.log(`\nDone! Indexed ${imported} GPX files, skipped ${skipped}`);
console.log(`Updated ${TRAILS_FILE} (GPX data removed)`);
console.log(`Created ${INDEX_FILE}`);
```

### 3. `server/src/services/dataService.ts` — Load gpx_index, strip gpxData

Add near top of file (after existing imports):
```typescript
import { Trail, TrailDetail, ScheduleData, LookupData, TrailsData, TrailDetailsData } from '@shared/types/index.js';
// Add: type GpxIndex = Record<string, string>;
```

Add after `let schedule: ScheduleData = {};`:
```typescript
let gpxIndex: GpxIndex = {};
```

In `loadData()`, after loading schedule:
```typescript
  gpxIndex = await loadFile('gpx_index.json', {});
  console.log(`[DATA] Loaded ${Object.keys(gpxIndex).length} GPX mappings`);
```

Update `loadData()` trail loading to strip gpxData:
```typescript
  trails = rawTrails.map(t => {
    const { gpxData, ...rest } = t; // strip gpxData if present
    return { ...rest, seasonal: normalizeSeasonal(rest.seasonal) };
  });
```

Add getter:
```typescript
export function getGpxIndex(): GpxIndex {
  return { ...gpxIndex };
}

export function getGpxFileName(trailId: string): string | undefined {
  return gpxIndex[trailId];
}
```

### 4. `server/src/routes/trails.routes.ts` — Add GPX endpoint

Add import:
```typescript
import {
  getTrails,
  getTrailById,
  updateTrail,
  deleteTrail,
  getTrailDetails,
  getTrailDetailById,
  updateTrailDetail,
  getGpxFileName,  // ADD THIS
} from '../services/dataService.js';
```

Add new route before `export { router };`:
```typescript
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GPX_DIR = path.join(__dirname, '../../../GPX');

router.get('/gpx/:id', async (req, res) => {
  const gpxFile = getGpxFileName(req.params.id);
  if (!gpxFile) {
    return res.status(404).json({ success: false, error: { message: 'GPX not found for this trail' } });
  }
  const gpxPath = path.join(GPX_DIR, gpxFile);
  try {
    const content = await fs.readFile(gpxPath, 'utf-8');
    res.set('Content-Type', 'application/gpx+xml');
    res.set('Cache-Control', 'public, max-age=604800'); // 1 week
    res.send(content);
  } catch {
    res.status(404).json({ success: false, error: { message: 'GPX file not found' } });
  }
});
```

### 5. `server/src/index.ts` — Add compression middleware

Add import near top:
```typescript
import compression from 'compression';
```

Add middleware before `app.use('/api', apiLimiter);`:
```typescript
app.use(compression());
```

### 6. `src/api/client.js` — Add getGpx()

Add new function:
```javascript
export async function getGpx(trailId) {
  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/trails/gpx/${trailId}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    const error = await res.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(error.error?.message || `HTTP ${res.status}`);
  }
  return res.text();
}
```

### 7. `src/components/TrailCard.jsx` — hasGpx + on-demand fetch

```diff
- {trail.gpxData && (
+ {trail.hasGpx && (
    <Button
-     onClick={() => {
-       shareGpxFile(trail.gpxData, trail.fullName || trail.name);
-     }}
+     onClick={async () => {
+       const gpx = await api.getGpx(trail.id);
+       if (gpx) shareGpxFile(gpx, trail.fullName || trail.name);
+     }}
```

Also need to import `api` at top:
```javascript
import * as api from '../api/client';
```

### 8. `src/pages/TrailDetail.jsx` — hasGpx + on-demand fetch

For the "Share GPX" button (non-edit mode, ~line 535):
```diff
- {trail.gpxData && (
+ {trail.hasGpx && (
    <Button
-     onClick={() => shareGpxFile(trail.gpxData, trail.fullName || trail.name)}
+     onClick={async () => {
+       const gpx = await api.getGpx(trail.id);
+       if (gpx) shareGpxFile(gpx, trail.fullName || trail.name);
+     }}
```

For edit mode (~line 911), the GPX editing still works through the trail object's `gpxData` field (imported via file picker, saved via `updateTrail`). The `editedFields.gpxData` is a local edit state, not from the initial trail load. This doesn't need changes for the read path, but the initial view of existing GPX in edit mode would need a fetch. Two options:
- Keep it simple: in edit mode, fetch GPX on mount if `trail.hasGpx`
- Or: show a "Load GPX" button in edit mode

The simplest approach for edit mode: when entering edit mode for a trail with `hasGpx`, fetch the GPX and set it in `editedFields`. This can be done in the effect that initializes edit state.

### 9. `.gitignore` — Ensure gpx_index.json is not committed

Add to existing `exported_data/` exclusion (already covered, as gpx_index.json is in exported_data/).

---

## Post-Change Steps

1. Run `npm run build:all` to compile shared types
2. Run `node scripts/import-gpx-files.cjs` to regenerate trails.json (without GPX) and create gpx_index.json
3. Run `npm run test:run` to verify tests pass
4. Check trails.json file size — should drop from ~100MB to ~180KB

## Expected Results
- `trails.json`: 100MB → ~180KB (550x smaller)
- Initial API response: 100MB → ~180KB (compressed: ~30KB)
- GPX load: on-demand, ~1-3MB per file, cached 1 week
- Server memory: proportional reduction from not holding 96MB of GPX strings
