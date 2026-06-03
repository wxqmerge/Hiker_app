import { useState, useCallback, useRef, useEffect } from 'react';
import { openDB } from 'idb';

const DB_NAME = 'hiker-trails';
const DB_VERSION = 1;
const TRAILS_STORE = 'trails';
const DETAILS_STORE = 'details';

let _trails = [];
let _trailDetails = {};
let _loading = true;
let _subscribers = [];

function notifySubscribers() {
  _subscribers.forEach(fn => fn());
}

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

function getEmbeddedData() {
  const embedded = window.__EMBEDDED_DATA__;
  if (!embedded) return { trails: [], details: {} };
  const trails = embedded.trails?.trails || embedded.trails || [];
  const details = embedded.trail_details || {};
  return { trails, details };
}

function syncFromEmbedded() {
  const embeddedData = getEmbeddedData();
  if (embeddedData.trails.length === 0) return;

  const existingIds = new Set(_trails.map(t => t.id));
  for (const trail of embeddedData.trails) {
    if (!existingIds.has(trail.id)) {
      _trails.push(trail);
    }
  }
  for (const [id, detail] of Object.entries(embeddedData.details)) {
    if (!_trailDetails[id]) {
      _trailDetails[id] = detail;
    }
  }
}

async function seedDB() {
  const db = await initDB();
  const existingTrails = await db.getAll(TRAILS_STORE);
  if (existingTrails.length > 0) return;

  const embeddedData = getEmbeddedData();
  for (const trail of embeddedData.trails) {
    await db.put(TRAILS_STORE, trail);
  }
  for (const [id, detail] of Object.entries(embeddedData.details)) {
    await db.put(DETAILS_STORE, { id, ...detail });
  }
}

async function loadAll() {
  const db = await initDB();
  const trails = await db.getAll(TRAILS_STORE);
  const detailsList = await db.getAll(DETAILS_STORE);
  const detailsObj = {};
  for (const item of detailsList) {
    detailsObj[item.id] = item;
  }
  return { trails, details: detailsObj };
}

function setState(trails, details, loading) {
  _trails = trails;
  _trailDetails = details;
  _loading = loading;
  notifySubscribers();
}

// Seed synchronously on module load so tests and immediate renders see data
syncFromEmbedded();
if (_trails.length > 0) _loading = false;

async function initSharedState() {
  await seedDB();
  const { trails, details } = await loadAll();
  if (trails.length > 0) {
    setState(trails, details, false);
  }
}

export function useTrailStore() {
  const mountedRef = useRef(true);

  const [state, setStateLocal] = useState(() => ({
    trails: [..._trails],
    trailDetails: { ..._trailDetails },
    loading: _loading,
  }));

  const subscribe = useCallback(() => {
    const sub = () => {
      if (mountedRef.current) setStateLocal({
        trails: _trails,
        trailDetails: _trailDetails,
        loading: _loading,
      });
    };
    _subscribers.push(sub);
    return () => {
      _subscribers = _subscribers.filter(s => s !== sub);
    };
  }, []);

  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, [subscribe]);

  const saveTrail = useCallback(async (trail) => {
    const db = await initDB();
    await db.put(TRAILS_STORE, trail);
    const idx = _trails.findIndex(t => t.id === trail.id);
    if (idx >= 0) {
      _trails[idx] = trail;
    } else {
      _trails.push(trail);
    }
    setState([..._trails], _trailDetails, false);
  }, []);

  const saveTrailDetail = useCallback(async (trailId, detail) => {
    const db = await initDB();
    await db.put(DETAILS_STORE, { id: trailId, ...detail });
    const newDetails = { ..._trailDetails, [trailId]: detail };
    setState([..._trails], newDetails, false);
  }, []);

  const deleteTrail = useCallback(async (trailId) => {
    const db = await initDB();
    await db.delete(TRAILS_STORE, trailId);
    await db.delete(DETAILS_STORE, trailId);
    const newTrails = _trails.filter(t => t.id !== trailId);
    const newDetails = { ..._trailDetails };
    delete newDetails[trailId];
    setState(newTrails, newDetails, false);
  }, []);

  const exportJSON = useCallback(async () => {
    const { trails, details } = await loadAll();
    return { trails: { trails }, trailDetails: details };
  }, []);

  const importJSON = useCallback(async (data) => {
    const db = await initDB();
    const importedTrails = data.trails?.trails || data.trails || [];
    const importedDetails = data.trailDetails || data.trail_details || {};

    _trails.length = 0;
    for (const trail of importedTrails) {
      await db.put(TRAILS_STORE, trail);
      _trails.push(trail);
    }
    _trailDetails = {};
    for (const [id, detail] of Object.entries(importedDetails)) {
      await db.put(DETAILS_STORE, { id, ...detail });
      _trailDetails[id] = detail;
    }
    setState([..._trails], { ..._trailDetails }, false);
  }, []);

  return {
    trails: state.trails,
    trailDetails: state.trailDetails,
    loading: state.loading,
    saveTrail,
    saveTrailDetail,
    deleteTrail,
    exportJSON,
    importJSON,
  };
}
