# IndexedDB Trail Storage Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace localStorage with IndexedDB for persistent trail data, add trail CRUD management page, and add Excel export capability.

**Architecture:** IndexedDB via `idb` library as the single source of truth at runtime. On first load, seed from embedded data. On subsequent loads, smart-merge: add new trails from embedded data, preserve existing trail edits. Existing edit modal in `TrailDetail.jsx` is reused — only storage backend changes.

**Tech Stack:** `idb` (IndexedDB wrapper), React 19, Vite 8

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `hiker-app/src/hooks/useTrailStore.js` | IndexedDB CRUD hook |
| Create | `hiker-app/src/pages/TrailManager.jsx` | Trail CRUD management page |
| Modify | `hiker-app/src/hooks/useTrails.js` | Read from IndexedDB |
| Modify | `hiker-app/src/hooks/useTrailDetails.js` | Read from IndexedDB |
| Modify | `hiker-app/src/pages/TrailDetail.jsx` | Use IndexedDB instead of localStorage |
| Modify | `hiker-app/src/pages/Home.jsx` | Link to TrailManager, remove export |
| Modify | `hiker-app/src/pages/ScheduleBuilder.jsx` | Use IndexedDB for trail edits |
| Modify | `hiker-app/src/App.jsx` | Add `/trails` route |
| Create | `export_to_xls.py` | Python script: JSON → Excel |

---

## Chunk 1: IndexedDB Hook

### Task 1: Add idb dependency

**Files:**
- Modify: `hiker-app/package.json`

- [x] **Step 1: Install idb**

Run: `cd hiker-app && npm install idb`
Expected: `idb` added to dependencies

- [x] **Step 2: Commit**

```bash
git add hiker-app/package.json hiker-app/package-lock.json
git commit -m "deps: add idb for IndexedDB wrapper"
```

### Task 2: Create useTrailStore hook

**Files:**
- Create: `hiker-app/src/hooks/useTrailStore.js`

- [x] **Step 1: Write the hook**

The hook provides these methods:
- `trails` — reactive trail array (state)
- `trailDetails` — reactive trail details object (state)
- `loading` — boolean
- `saveTrail(trail)` — upsert a trail record
- `saveTrailDetail(trailId, detail)` — upsert trail detail
- `deleteTrail(trailId)` — remove trail and its details
- `exportJSON()` — return `{ trails, trailDetails }` object
- `importJSON(data)` — merge imported data into store

Implementation details:
- DB name: `hiker-trails`, version: 1, stores: `trails` (keyPath: `id`), `details` (keyPath: `id`)
- On mount: open DB, check if `trails` store is empty
  - If empty: seed from `window.__EMBEDDED_DATA__` (trails and trail_details)
  - If not empty: merge — add new trails from embedded data that don't exist in DB, keep existing trails with edits
- Read all trails and details from DB into state
- `saveTrail`: `put` into `trails` store, update local state
- `saveTrailDetail`: `put` into `details` store, update local state
- `deleteTrail`: `delete` from both stores, update local state
- `exportJSON`: read all from DB, return `{ trails: { trails: [...] }, trailDetails: {...} }`
- `importJSON`: merge imported trails/details into DB

```javascript
import { useState, useEffect, useCallback } from 'react';
import { openDB } from 'idb';

const DB_NAME = 'hiker-trails';
const DB_VERSION = 1;
const TRAILS_STORE = 'trails';
const DETAILS_STORE = 'details';

async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(TRAILS_STORE)) {
        db.createObjectStore(TRAILS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DETAILS_STORE)) {
        db.createObjectStore(DETAILS_STORE, { keyPath: 'id' });
      }
    },
  });
}

export function useTrailStore() {
  const [trails, setTrails] = useState([]);
  const [trailDetails, setTrailDetails] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const db = await initDB();
      
      // Read existing data
      let existingTrails = await db.getAll(TRAILS_STORE);
      let existingDetails = await db.getAll(DETAILS_STORE);
      const existingTrailIds = new Set(existingTrails.map(t => t.id));
      
      // Get embedded data for seeding/merging
      const embedded = window.__EMBEDDED_DATA__;
      
      if (embedded) {
        const embeddedTrails = embedded.trails?.trails || embedded.trails || [];
        const embeddedDetails = embedded.trail_details || {};
        
        if (existingTrails.length === 0) {
          // First load — seed from embedded data
          await db.clear(TRAILS_STORE);
          await db.clear(DETAILS_STORE);
          for (const trail of embeddedTrails) {
            await db.put(TRAILS_STORE, trail);
          }
          for (const [id, detail] of Object.entries(embeddedDetails)) {
            await db.put(DETAILS_STORE, { id, ...detail });
          }
          existingTrails = embeddedTrails;
          existingDetails = embeddedDetails;
        } else {
          // Merge: add new trails from embedded that don't exist
          const newTrails = [];
          for (const trail of embeddedTrails) {
            if (!existingTrailIds.has(trail.id)) {
              await db.put(TRAILS_STORE, trail);
              newTrails.push(trail);
            }
          }
          existingTrails = [...existingTrails, ...newTrails];
          
          // Add new details from embedded
          for (const [id, detail] of Object.entries(embeddedDetails)) {
            if (!existingDetails[id]) {
              await db.put(DETAILS_STORE, { id, ...detail });
              existingDetails[id] = detail;
            }
          }
        }
      }
      
      setTrails(existingTrails);
      setTrailDetails(existingDetails);
      setLoading(false);
    }
    load();
  }, []);

  const saveTrail = useCallback(async (trail) => {
    const db = await initDB();
    await db.put(TRAILS_STORE, trail);
    setTrails(prev => {
      const idx = prev.findIndex(t => t.id === trail.id);
      if (idx === -1) return [...prev, trail];
      const next = [...prev];
      next[idx] = trail;
      return next;
    });
  }, []);

  const saveTrailDetail = useCallback(async (trailId, detail) => {
    const db = await initDB();
    await db.put(DETAILS_STORE, { id: trailId, ...detail });
    setTrailDetails(prev => ({ ...prev, [trailId]: detail }));
  }, []);

  const deleteTrail = useCallback(async (trailId) => {
    const db = await initDB();
    await db.delete(TRAILS_STORE, trailId);
    await db.delete(DETAILS_STORE, trailId);
    setTrails(prev => prev.filter(t => t.id !== trailId));
    setTrailDetails(prev => {
      const next = { ...prev };
      delete next[trailId];
      return next;
    });
  }, []);

  const exportJSON = useCallback(async () => {
    const db = await initDB();
    const t = await db.getAll(TRAILS_STORE);
    const d = await db.getAll(DETAILS_STORE);
    const detailsObj = {};
    for (const item of d) {
      detailsObj[item.id] = item;
    }
    return { trails: { trails: t }, trailDetails: detailsObj };
  }, []);

  const importJSON = useCallback(async (data) => {
    const db = await initDB();
    const importedTrails = data.trails?.trails || data.trails || [];
    const importedDetails = data.trailDetails || data.trail_details || {};
    
    for (const trail of importedTrails) {
      await db.put(TRAILS_STORE, trail);
    }
    for (const [id, detail] of Object.entries(importedDetails)) {
      await db.put(DETAILS_STORE, { id, ...detail });
    }
    
    const t = await db.getAll(TRAILS_STORE);
    const d = await db.getAll(DETAILS_STORE);
    const detailsObj = {};
    for (const item of d) {
      detailsObj[item.id] = item;
    }
    setTrails(t);
    setTrailDetails(detailsObj);
  }, []);

  return {
    trails,
    trailDetails,
    loading,
    saveTrail,
    saveTrailDetail,
    deleteTrail,
    exportJSON,
    importJSON,
  };
}
```

- [x] **Step 2: Commit**

```bash
git add hiker-app/src/hooks/useTrailStore.js
git commit -m "feat: add useTrailStore IndexedDB hook with smart merge"
```

---

## Chunk 2: Update Data Hooks

### Task 3: Update useTrails to use IndexedDB

**Files:**
- Modify: `hiker-app/src/hooks/useTrails.js`

- [x] **Step 1: Replace data loading with useTrailStore**

Replace the `useTrails` hook to use `useTrailStore` for data. The hook should:
1. Call `useTrailStore()` to get trails, trailDetails, loading
2. Keep `lookup` from embedded data (it doesn't change)
3. Keep `schedule` from embedded data (it doesn't change)
4. Return `{ trails, lookup, schedule, trailDetails, loading, error }`

```javascript
import { useState, useEffect, useMemo } from 'react';
import { filterTrails, sortTrails } from '../utils/filterTrails';
import { useTrailStore } from './useTrailStore';

export function useTrails() {
  const { trails, trailDetails, loading } = useTrailStore();
  const [lookup, setLookup] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (window.__EMBEDDED_DATA__) {
      setLookup(window.__EMBEDDED_DATA__.lookup);
      if (window.__EMBEDDED_DATA__.schedule) {
        setSchedule(window.__EMBEDDED_DATA__.schedule);
      }
    }
  }, []);

  return { trails, lookup, schedule, trailDetails, loading, error };
}

export function useFilters(trails) {
  // ... keep existing implementation unchanged
}
```

- [x] **Step 2: Commit**

```bash
git add hiker-app/src/hooks/useTrails.js
git commit -m "refactor: useTrails reads from IndexedDB via useTrailStore"
```

### Task 4: Update useTrailDetails to use IndexedDB

**Files:**
- Modify: `hiker-app/src/hooks/useTrailDetails.js`

- [x] **Step 1: Replace with useTrailStore**

```javascript
import { useTrailStore } from './useTrailStore';

export function useTrailDetails() {
  const { trailDetails } = useTrailStore();
  return trailDetails;
}
```

- [x] **Step 2: Commit**

```bash
git add hiker-app/src/hooks/useTrailDetails.js
git commit -m "refactor: useTrailDetails reads from IndexedDB via useTrailStore"
```

---

## Chunk 3: Update TrailDetail Page

### Task 5: Change TrailDetail storage to IndexedDB

**Files:**
- Modify: `hiker-app/src/pages/TrailDetail.jsx`

- [x] **Step 1: Replace localStorage with IndexedDB calls**

Changes needed:
1. Remove `EDIT_STORAGE_KEY` constant
2. Replace `saveEdits()` to call `saveTrail()` and `saveTrailDetail()` from `useTrailStore`
3. Replace `exportEdits()`, `importEdits()`, `exportTrailEdits()` to use `useTrailStore` methods
4. Remove the `useEffect` that loads edits from localStorage (edits are now persisted immediately)
5. The edit modal UI stays the same — only the storage backend changes

Key changes:
```javascript
// Remove:
const EDIT_STORAGE_KEY = 'hiker-trail-edits';

// Replace saveEdits to persist trail + detail separately:
const saveEdits = async () => {
  // Build updated trail object from edited fields
  const updatedTrail = { ...trail };
  if (editedFields.fullName !== undefined) updatedTrail.fullName = editedFields.fullName;
  if (editedFields.distance !== undefined) updatedTrail.distance = editedFields.distance;
  if (editedFields.distanceExtended !== undefined) updatedTrail.distanceExtended = editedFields.distanceExtended;
  if (editedFields.elevationStart !== undefined) updatedTrail.elevationStart = editedFields.elevationStart;
  if (editedFields.elevationMax !== undefined) updatedTrail.elevationMax = editedFields.elevationMax;
  if (editedFields.difficulty !== undefined) updatedTrail.difficulty = editedFields.difficulty;
  if (editedFields.parking !== undefined) updatedTrail.parking = editedFields.parking;
  if (editedFields.range !== undefined) updatedTrail.range = editedFields.range;
  if (editedFields.notes !== undefined) updatedTrail.notes = editedFields.notes;
  
  // Handle seasonal fields
  if (editedFields.bestSeason !== undefined || editedFields.parkingInfo !== undefined || editedFields.availableMonths !== undefined) {
    if (!updatedTrail.seasonal) updatedTrail.seasonal = {};
    if (editedFields.bestSeason !== undefined) updatedTrail.seasonal.bestSeason = editedFields.bestSeason;
    if (editedFields.parkingInfo !== undefined) updatedTrail.seasonal.parkingInfo = editedFields.parkingInfo;
    if (editedFields.availableMonths !== undefined) updatedTrail.seasonal.availableMonths = editedFields.availableMonths;
  }
  
  await saveTrail(updatedTrail);
  
  // Build updated detail object
  const updatedDetail = {};
  if (editedFields.description !== undefined) updatedDetail.fullDescription = editedFields.description;
  if (editedFields.pros !== undefined) updatedDetail.pros = editedFields.pros;
  if (editedFields.others !== undefined) updatedDetail.others = editedFields.others;
  if (editedFields.leaders !== undefined) updatedDetail.leaders = editedFields.leaders;
  
  if (Object.keys(updatedDetail).length > 0) {
    await saveTrailDetail(trail.id, updatedDetail);
  }
  
  setIsEditMode(false);
};

// Replace exportEdits:
const exportEdits = async () => {
  const data = await exportJSON();
  downloadBlob(JSON.stringify(data, null, 2), 'trail-data.json');
};

// Replace importEdits:
const importEdits = () => {
  createImportFileInput(
    async (imported) => {
      await importJSON(imported);
      alert('Data imported successfully!');
      window.location.reload();
    },
    (msg) => alert(msg)
  );
};
```

- [x] **Step 2: Remove localStorage references**

Remove all `localStorage.getItem(EDIT_STORAGE_KEY)` and `localStorage.setItem(EDIT_STORAGE_KEY)` calls. The `useEffect` that loads saved edits on mount should be removed since IndexedDB now provides the data reactively.

- [x] **Step 3: Commit**

```bash
git add hiker-app/src/pages/TrailDetail.jsx
git commit -m "refactor: TrailDetail uses IndexedDB instead of localStorage"
```

---

## Chunk 4: Trail Manager Page

### Task 6: Create TrailManager page

**Files:**
- Create: `hiker-app/src/pages/TrailManager.jsx`

- [x] **Step 1: Write the TrailManager page**

This page provides:
- Searchable trail list with edit/delete buttons
- "New Trail" button (opens edit modal with empty form)
- "Import JSON" / "Export JSON" buttons
- "Export to Excel" button (downloads JSON for Python script)

The page should:
1. Use `useTrailStore()` for data and CRUD operations
2. Have a search input for filtering trails
3. Show trail name, distance, difficulty in a table/list
4. Each row has edit icon (navigates to `/trail/:id`) and delete icon (with confirmation)
5. "New Trail" creates a trail with generated ID and opens edit mode

```javascript
import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTrailStore } from '../hooks/useTrailStore';
import { downloadBlob, createImportFileInput } from '../utils/io';

export default function TrailManager() {
  const { trails, trailDetails, loading, saveTrail, saveTrailDetail, deleteTrail, exportJSON, importJSON } = useTrailStore();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const filteredTrails = useMemo(() => {
    if (!search) return trails;
    const q = search.toLowerCase();
    return trails.filter(t =>
      t.name?.toLowerCase().includes(q) ||
      t.fullName?.toLowerCase().includes(q) ||
      t.id?.toLowerCase().includes(q)
    );
  }, [trails, search]);

  const handleDelete = async (trail) => {
    if (confirm(`Delete trail "${trail.name}"?`)) {
      await deleteTrail(trail.id);
    }
  };

  const handleNewTrail = async () => {
    const name = prompt('Trail name:');
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (trails.find(t => t.id === id)) {
      alert('A trail with this ID already exists.');
      return;
    }
    const newTrail = {
      id,
      name,
      fullName: name,
      distance: null,
      distanceExtended: null,
      elevationStart: null,
      elevationMax: null,
      difficulty: 'Unknown',
      notes: '',
      seasonal: { availableMonths: [], bestSeason: '' },
      difficultyOrder: 99,
    };
    await saveTrail(newTrail);
    navigate(`/trail/${id}`);
  };

  const handleExport = async () => {
    const data = await exportJSON();
    downloadBlob(JSON.stringify(data, null, 2), 'trail-data-export.json');
  };

  const handleImport = () => {
    createImportFileInput(
      async (imported) => {
        await importJSON(imported);
        alert('Data imported successfully!');
      },
      (msg) => alert(msg)
    );
  };

  const handleExportForExcel = async () => {
     const data = await exportJSON();
     downloadBlob(
       JSON.stringify({ trails: data.trails.trails, trail_details: data.trailDetails }, null, 2),
       'export_for_excel.json'
     );
   };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-3 max-w-4xl">
        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-gray-900">Trail Manager</h2>
          <span className="text-gray-300">|</span>
          <Link to="/" className="text-green-700 hover:text-green-900 font-medium text-sm">
            Browse Trails
          </Link>
          <p className="text-gray-600 text-sm ml-auto">
            {filteredTrails.length} of {trails.length} trails
          </p>
        </div>

        {/* Actions bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search trails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
          />
          <button onClick={handleNewTrail} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Trail
          </button>
          <button onClick={handleExport} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm">
            Export JSON
          </button>
          <button onClick={handleImport} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm">
            Import JSON
          </button>
          <button onClick={handleExportForExcel} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm">
            Export for Excel
          </button>
        </div>

        {/* Trail list */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-right px-2 py-3 text-sm font-semibold text-gray-700 w-12">#</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Distance</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Difficulty</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrails.map((trail, index) => (
                  <tr key={trail.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-3 text-right text-sm text-gray-400">{index + 1}</td>
                    <td className="px-4 py-3">
                      <Link to={`/trail/${trail.id}`} className="text-green-700 hover:text-green-900 font-medium">
                        {trail.name}
                      </Link>
                      <span className="ml-2 text-xs text-gray-400">{trail.id}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {trail.distance != null ? `${trail.distance} mi` : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{trail.difficulty}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/trail/${trail.id}`}
                          className="text-green-600 hover:text-green-800"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleDelete(trail)}
                          className="text-red-400 hover:text-red-600"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredTrails.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {search ? 'No trails match your search.' : 'No trails found. Import or create trails to get started.'}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add hiker-app/src/pages/TrailManager.jsx
git commit -m "feat: add TrailManager page with CRUD operations"
```

---

## Chunk 5: Routing and Page Updates

### Task 7: Add /trails route

**Files:**
- Modify: `hiker-app/src/App.jsx`

- [x] **Step 1: Add TrailManager route**

```javascript
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import TrailDetail from './pages/TrailDetail';
import ScheduleBuilder from './pages/ScheduleBuilder';
import TrailManager from './pages/TrailManager';

function App() {
  return (
    <MemoryRouter initialEntries={['/']} initialIndex={0}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trail/:id" element={<TrailDetail />} />
        <Route path="/trails" element={<TrailManager />} />
        <Route path="/schedule" element={<ScheduleBuilder />} />
      </Routes>
    </MemoryRouter>
  );
}

export default App;
```

- [x] **Step 2: Commit**

```bash
git add hiker-app/src/App.jsx
git commit -m "feat: add /trails route for trail management"
```

### Task 8: Update Home page

**Files:**
- Modify: `hiker-app/src/pages/Home.jsx`

- [x] **Step 1: Simplify Home page**

Changes:
1. Remove `exportMergedData` function (no longer needed — edits are persisted immediately)
2. Remove `hasEdits` state and `useEffect` that checks localStorage
3. Remove the floating "Export Merged Data" bar
4. Add link to `/trails` in the header
5. Remove `useTrailDetails` import (no longer needed on Home)
6. Remove `downloadBlob` import

```javascript
// Changes to header:
<div className="mb-6 flex items-baseline gap-3">
  <h2 className="text-2xl font-bold text-gray-900">Browse Trails</h2>
  <span className="text-gray-300">|</span>
  <Link to="/trails" className="text-green-700 hover:text-green-900 font-medium text-sm">
    Manage Trails
  </Link>
  <Link to="/schedule" className="text-green-700 hover:text-green-900 font-medium text-sm">
    Schedule Builder
  </Link>
  {/* ... rest unchanged ... */}
</div>
```

Remove the entire `exportMergedData` function and the floating bar JSX.

- [x] **Step 2: Commit**

```bash
git add hiker-app/src/pages/Home.jsx
git commit -m "refactor: simplify Home page, link to trail manager"
```

### Task 9: Update ScheduleBuilder

**Files:**
- Modify: `hiker-app/src/pages/ScheduleBuilder.jsx`

- [x] **Step 1: Update trail edit references**

Changes:
1. Replace `exportHikeEdits` (line 286) to use `useTrailStore` export
2. Replace `importHikeEdits` (line 291) to use `useTrailStore` import
3. The schedule data itself (`hiker-schedule` localStorage key) can stay as-is — it's schedule state, not trail data

Add `useTrailStore` import and use it for the export/import functions:

```javascript
import { useTrailStore } from '../hooks/useTrailStore';

// In component:
const { exportJSON, importJSON: importTrailData } = useTrailStore();

const exportHikeEdits = async () => {
  const data = await exportJSON();
  downloadBlob(JSON.stringify(data, null, 2), `trail-data-${new Date().toISOString().split('T')[0]}.json`);
};

const importHikeEdits = () => {
  createImportFileInput(
    async (imported) => {
      await importTrailData(imported);
      alert('Trail data imported successfully!');
    },
    (msg) => alert(msg)
  );
  setShowSettings(false);
};
```

- [x] **Step 2: Commit**

```bash
git add hiker-app/src/pages/ScheduleBuilder.jsx
git commit -m "refactor: ScheduleBuilder uses IndexedDB for trail data export/import"
```

---

## Chunk 6: Excel Export Script

### Task 10: Create export_to_xls.py

**Files:**
- Create: `export_to_xls.py` (root directory, alongside `extract_trails_xls.py`)

- [x] **Step 1: Write the Python script**

This script reads `trails.json` and `trail_details.json` and writes them to the Excel format matching `Hike Data BaseM.xls`.

Column mapping for Index sheet (matching extract script):
- A (0): fullName
- B (1): distance
- C (2): distanceExtended
- D (3): elevationStart
- E (4): elevationMax
- G (6): range
- H (7): Q1
- I (8): Q2
- L (11): Q3
- P (15): Q4
- R (17): difficulty
- S (18): short name (trail.name)

Quarter mapping (reverse of extract):
- Q1: months 3,4,5 (Mar,Apr,May)
- Q2: months 6,7,8 (Jun,Jul,Aug)
- Q3: months 9,10,11 (Sep,Oct,Nov)
- Q4: months 12,1,2 (Dec,Jan,Feb)

Per-trail detail sheets:
- A1: sheet name (trail short name)
- B4: parking
- G5: range
- A7-A18: description (split into ~12 lines)
- B14: pros
- B17: others
- B20: leaders (comma-separated)

```python
import json
import re
from pathlib import Path
from openpyxl import Workbook
from openpyxl.utils import get_column_letter

def month_to_quarters(months):
    """Convert month indices to quarter markers."""
    quarters = {}
    q1_months = {3, 4, 5}
    q2_months = {6, 7, 8}
    q3_months = {9, 10, 11}
    q4_months = {12, 1, 2}
    
    if any(m in q1_months for m in months):
        quarters['Q1'] = '1'
    if any(m in q2_months for m in months):
        quarters['Q2'] = '1'
    if any(m in q3_months for m in months):
        quarters['Q3'] = '1'
    if any(m in q4_months for m in months):
        quarters['Q4'] = '1'
    
    return quarters

def main():
    data_path = Path('export_for_excel.json')

    if not data_path.exists():
        print("Error: export_for_excel.json not found. Run 'Export for Excel' from the app first.")
        return

    with open(data_path) as f:
        data = json.load(f)

    trails = data.get('trails', [])
    details_data = data.get('trail_details', {})
    
    # Create workbook
    wb = Workbook()
    
    # Create Index sheet
    ws_index = wb.active
    ws_index.title = 'Index'
    
    # Column positions (0-indexed)
    COL_FULL_NAME = 0    # A
    COL_DISTANCE = 1     # B
    COL_DIST_EXT = 2     # C
    COL_ELEV_START = 3   # D
    COL_ELEV_MAX = 4     # E
    COL_RANGE = 6        # G
    COL_Q1 = 7           # H
    COL_Q2 = 8           # I
    COL_Q3 = 11          # L
    COL_Q4 = 15          # P
    COL_DIFFICULTY = 17  # R
    COL_SHORT_NAME = 18  # S
    
    # Write header row
    ws_index.cell(row=1, column=COL_FULL_NAME + 1, value='Full Name')
    ws_index.cell(row=1, column=COL_DISTANCE + 1, value='Distance')
    ws_index.cell(row=1, column=COL_DIST_EXT + 1, value='Distance Extended')
    ws_index.cell(row=1, column=COL_ELEV_START + 1, value='Elevation Start')
    ws_index.cell(row=1, column=COL_ELEV_MAX + 1, value='Elevation Max')
    ws_index.cell(row=1, column=COL_RANGE + 1, value='Range')
    ws_index.cell(row=1, column=COL_DIFFICULTY + 1, value='Difficulty')
    ws_index.cell(row=1, column=COL_SHORT_NAME + 1, value='Short Name')
    
    # Write trail rows
    for idx, trail in enumerate(trails, start=2):
        row = idx
        
        # Get seasonal data
        seasonal = trail.get('seasonal', {})
        available_months = seasonal.get('availableMonths', [])
        quarters = month_to_quarters(available_months)
        
        ws_index.cell(row=row, column=COL_FULL_NAME + 1, value=trail.get('fullName', trail.get('name', '')))
        ws_index.cell(row=row, column=COL_DISTANCE + 1, value=trail.get('distance'))
        ws_index.cell(row=row, column=COL_DIST_EXT + 1, value=trail.get('distanceExtended'))
        ws_index.cell(row=row, column=COL_ELEV_START + 1, value=trail.get('elevationStart'))
        ws_index.cell(row=row, column=COL_ELEV_MAX + 1, value=trail.get('elevationMax'))
        ws_index.cell(row=row, column=COL_RANGE + 1, value=trail.get('range'))
        ws_index.cell(row=row, column=COL_Q1 + 1, value=quarters.get('Q1'))
        ws_index.cell(row=row, column=COL_Q2 + 1, value=quarters.get('Q2'))
        ws_index.cell(row=row, column=COL_Q3 + 1, value=quarters.get('Q3'))
        ws_index.cell(row=row, column=COL_Q4 + 1, value=quarters.get('Q4'))
        ws_index.cell(row=row, column=COL_DIFFICULTY + 1, value=trail.get('difficulty', 'Unknown'))
        ws_index.cell(row=row, column=COL_SHORT_NAME + 1, value=trail.get('name', ''))
        
        # Create per-trail detail sheet
        trail_id = trail.get('id', '')
        sheet_name = trail.get('name', f'sheet{idx}')
        # Sanitize sheet name (Excel limits: 31 chars, no special chars)
        sheet_name = re.sub(r'[/\\?*:\[\]]', '', sheet_name)[:31]
        if not sheet_name:
            sheet_name = f'trail{idx}'
        
        # Avoid duplicate sheet names
        existing_names = [ws.title for ws in wb.worksheets]
        if sheet_name in existing_names:
            counter = 2
            while f'{sheet_name}_{counter}' in existing_names:
                counter += 1
            sheet_name = f'{sheet_name}_{counter}'[:31]
        
        ws_detail = wb.create_sheet(title=sheet_name)
        
        # A1: trail name
        ws_detail.cell(row=1, column=1, value=sheet_name)
        
        # Get detail data
        detail = details_data.get(trail_id, {})
        
        # B4: parking
        parking = trail.get('parking') or detail.get('parking')
        if parking:
            ws_detail.cell(row=4, column=2, value=parking)
        
        # G5: range
        range_val = trail.get('range') or detail.get('range')
        if range_val:
            ws_detail.cell(row=5, column=7, value=range_val)
        
        # A7-A18: description (split into lines)
        description = detail.get('fullDescription', '')
        if description:
            words = description.split()
            lines = []
            current_line = []
            current_length = 0
            for word in words:
                if current_length + len(word) + 1 > 80:
                    lines.append(' '.join(current_line))
                    current_line = [word]
                    current_length = len(word)
                else:
                    current_line.append(word)
                    current_length += len(word) + 1
            if current_line:
                lines.append(' '.join(current_line))
            
            for i, line in enumerate(lines[:12]):
                ws_detail.cell(row=7 + i, column=1, value=line)
        
        # B14: pros
        pros = detail.get('pros')
        if pros:
            ws_detail.cell(row=14, column=2, value=pros)
        
        # B17: others
        others = detail.get('others')
        if others:
            ws_detail.cell(row=17, column=2, value=others)
        
        # B20: leaders
        leaders = detail.get('leaders', [])
        if leaders:
            ws_detail.cell(row=20, column=2, value=', '.join(leaders))
    
    # Save
    output_path = Path('hiker_export.xlsx')
    wb.save(output_path)
    print(f"Exported {len(trails)} trails to {output_path}")

if __name__ == '__main__':
    main()
```

- [x] **Step 2: Commit**

```bash
git add export_to_xls.py
git commit -m "feat: add export_to_xls.py for JSON to Excel export"
```

---

## Chunk 7: Verification

### Task 11: Build and verify

- [x] **Step 1: Run lint**

Run: `cd hiker-app && npm run lint`
Expected: No errors

- [x] **Step 2: Run build**

Run: `cd hiker-app && npm run build`
Expected: Successful build, `dist/index.html` created

- [x] **Step 3: Manual verification checklist**

1. Open `dist/index.html` in browser — trails load from embedded data
2. Edit a trail — changes persist across page navigation
3. Refresh page — edits are preserved (IndexedDB)
4. Navigate to `/trails` — trail manager shows all trails with index numbers
5. Search for trails — filters by name, fullName, and ID
6. Delete a trail — it's removed from list and detail page
7. Create new trail — it appears in list and is editable
8. Export JSON — downloads `trail-data-export.json` (for app import)
9. Export for Excel — downloads single `export_for_excel.json`
10. Run `python export_to_xls.py` — produces `hiker_export.xlsx`

- [x] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: IndexedDB trail storage with CRUD management"
```

---

## Notes for Implementation

1. **Existing edit modal reuse**: The edit modal in `TrailDetail.jsx` (lines 475-696) is comprehensive and should be kept as-is. Only change the storage backend from localStorage to IndexedDB.

2. **`getEditedValue()` pattern**: This can be simplified since IndexedDB stores the merged data directly. The `getEditedValue` function can just read from the trail/trailDetails state provided by `useTrailStore`.

3. **ScheduleBuilder schedule data**: The schedule data (`hiker-schedule` localStorage key) is NOT trail data — it's user schedule state. Keep it in localStorage. Only the trail edits should move to IndexedDB.

4. **`lookup` and `schedule` from embedded data**: These are static reference data that doesn't change via the app. They can continue to be read from `window.__EMBEDDED_DATA__` directly.

5. **`idb` library**: This is a tiny (~3KB) wrapper around the verbose native IndexedDB API. It makes the code much cleaner.
