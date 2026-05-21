import { useState, useEffect, useCallback, useMemo } from 'react';
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

// In test mode, initialize synchronously from embedded data
function getEmbeddedData() {
  const embedded = window.__EMBEDDED_DATA__;
  if (!embedded) return { trails: [], details: {} };
  const trails = embedded.trails?.trails || embedded.trails || [];
  const details = embedded.trail_details || {};
  return { trails, details };
}

export function useTrailStore() {
  const embedded = useMemo(() => getEmbeddedData(), []);

  const [trails, setTrails] = useState(embedded.trails);
  const [trailDetails, setTrailDetails] = useState(embedded.details);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const db = await initDB();

      let existingTrails = await db.getAll(TRAILS_STORE);
      let existingDetails = await db.getAll(DETAILS_STORE);
      const existingTrailIds = new Set(existingTrails.map(t => t.id));

      const embeddedData = getEmbeddedData();
      const embeddedTrails = embeddedData.trails;
      const embeddedDetails = embeddedData.details;

      if (existingTrails.length === 0) {
        await db.clear(TRAILS_STORE);
        await db.clear(DETAILS_STORE);
        for (const trail of embeddedTrails) {
          await db.put(TRAILS_STORE, trail);
        }
        for (const [id, detail] of Object.entries(embeddedDetails)) {
          await db.put(DETAILS_STORE, { id, ...detail });
        }
      } else {
        const newTrails = [];
        for (const trail of embeddedTrails) {
          if (!existingTrailIds.has(trail.id)) {
            await db.put(TRAILS_STORE, trail);
            newTrails.push(trail);
          }
        }
        if (newTrails.length > 0) {
          setTrails(prev => [...prev, ...newTrails]);
        }

        for (const [id, detail] of Object.entries(embeddedDetails)) {
          if (!existingDetails[id]) {
            await db.put(DETAILS_STORE, { id, ...detail });
          }
        }
      }

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
    setTrailDetails(prev => ({ ...prev, [trailId]: { ...prev[trailId], ...detail } }));
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
