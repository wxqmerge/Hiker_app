import { useCallback, useSyncExternalStore } from 'react';
import * as api from '../api/client.js';
import { getTrailName } from '../utils/data';

let _trails = [];
let _trailDetails = {};
let _loading = true;
let _lookup = null;
let _schedule = null;
let _subscribers = [];

// Single cached snapshot object, rebuilt on every mutation. useSyncExternalStore
// requires getSnapshot to return a stable reference between changes, and
// guarantees subscribers never miss an update that lands between render and
// subscription (the old manual useState+useEffect pattern could).
let _snapshot = _buildSnapshot();
function _buildSnapshot() {
  return { trails: _trails, trailDetails: _trailDetails, loading: _loading, lookup: _lookup, schedule: _schedule };
}

function publish(changed) {
  _snapshot = _buildSnapshot();
  _subscribers.forEach(fn => fn(changed));
}

function subscribe(cb) {
  _subscribers.push(cb);
  return () => { _subscribers = _subscribers.filter(s => s !== cb); };
}

function getSnapshot() {
  return _snapshot;
}

function setState(trails, details, loading, lookup, schedule) {
  _trails = trails;
  _trailDetails = details;
  _loading = loading;
  _lookup = lookup;
  _schedule = schedule;
  publish('all');
}

export function setSchedule(schedule) {
  _schedule = schedule;
  publish('schedule');
}

function setTrails(trails) {
  _trails = trails;
  publish('trails');
}

function setTrailDetails(details) {
  _trailDetails = details;
  publish('details');
}

let _initTimer = null;
let _initRetries = 0;
const INIT_MAX_RETRIES = 3;
const INIT_RETRY_MS = 5000;

async function initSharedState() {
  // allSettled, not all: one failing endpoint (server restart 503, flaky
  // mobile network) must not wipe the three that succeeded. Retry the batch a
  // few times so a transient startup failure self-heals without a manual
  // refresh (background PWAs freeze the schedule poller, so it can't).
  const settled = await Promise.allSettled([
    api.getTrails(),
    api.getTrailDetails(),
    api.getLookup(),
    api.getSchedule(),
  ]);
  const [trails, details, lookup, schedule] = settled.map(r => (r.status === 'fulfilled' ? r.value : null));
  for (const r of settled) {
    if (r.status === 'rejected') console.error('[useTrailStore] Failed to load data:', r.reason);
  }

  if (trails) _trails = trails;
  if (details) _trailDetails = details;
  if (lookup) _lookup = lookup;
  if (schedule) _schedule = schedule;
  // loading must become false, otherwise the app is stuck on the splash
  // spinner forever after a transient network failure.
  _loading = false;
  publish('all');

  const missing = !trails || !details || !lookup || !schedule;
  if (missing && _initRetries < INIT_MAX_RETRIES) {
    _initRetries++;
    clearTimeout(_initTimer);
    _initTimer = setTimeout(() => { _initTimer = null; initSharedState(); }, INIT_RETRY_MS);
  } else {
    _initRetries = 0;
  }
}

initSharedState();

export function resetTrailStore() {
  clearTimeout(_initTimer);
  _initTimer = null;
  _initRetries = 0;
  _trails = [];
  _trailDetails = {};
  _loading = true;
  _lookup = null;
  _schedule = null;
  _subscribers = [];
  publish('all');
  initSharedState();
}

export function useTrailStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  const saveTrail = useCallback(async (trail) => {
    const prevTrails = _trails;
    const idx = _trails.findIndex(t => t.id === trail.id);
    let newTrails;
    if (idx >= 0) {
      newTrails = _trails.map(t => t.id === trail.id ? trail : t);
    } else {
      newTrails = [..._trails, trail].sort((a, b) => getTrailName(a).localeCompare(getTrailName(b)));
    }
    setTrails(newTrails);
    try {
      await api.updateTrail(trail);
      return trail;
    } catch (error) {
      console.error('[useTrailStore] saveTrail error:', error);
      setTrails(prevTrails);
      throw error;
    }
  }, []);

  const saveTrailDetail = useCallback(async (trailId, detail) => {
    const prevDetails = _trailDetails;
    const existing = _trailDetails[trailId] || {};
    const newDetails = { ..._trailDetails, [trailId]: { ...existing, ...detail } };
    setTrailDetails(newDetails);
    try {
      await api.updateTrailDetail(trailId, { ...existing, ...detail });
    } catch (error) {
      console.error('[useTrailStore] saveTrailDetail error:', error);
      setTrailDetails(prevDetails);
      throw error;
    }
  }, []);

  const deleteTrail = useCallback(async (trailId) => {
    const prevTrails = _trails;
    const prevDetails = _trailDetails;
    const prevSchedule = _schedule;

    const newTrails = _trails.filter(t => t.id !== trailId);
    const newDetails = { ..._trailDetails };
    delete newDetails[trailId];

    let newSchedule = _schedule;
    if (newSchedule) {
      newSchedule = { ...newSchedule };
      for (const month of Object.keys(newSchedule)) {
        const entries = newSchedule[month];
        if (!Array.isArray(entries)) continue;
        const filtered = entries.filter(entry => entry?.trail_id !== trailId);
        if (filtered.length === 0) {
          delete newSchedule[month];
        } else if (filtered.length !== entries.length) {
          newSchedule[month] = filtered;
        }
      }
    }

    _trails = newTrails;
    _trailDetails = newDetails;
    _schedule = newSchedule;
    publish('all');

    try {
      await api.deleteTrail(trailId);
    } catch (error) {
      console.error('[useTrailStore] deleteTrail error:', error);
      _trails = prevTrails;
      _trailDetails = prevDetails;
      _schedule = prevSchedule;
      publish('all');
      throw error;
    }
  }, []);

  const exportJSON = useCallback(async () => {
    return { trails: { trails: [..._trails] }, trailDetails: { ..._trailDetails } };
  }, []);

  const importJSON = useCallback(async (data) => {
    const importedTrails = data.trails?.trails || data.trails || [];
    const importedDetails = data.trailDetails || data.trail_details || {};

    for (const trail of importedTrails) {
      await api.updateTrail(trail);
    }
    for (const [id, detail] of Object.entries(importedDetails)) {
      const existing = _trailDetails[id] || {};
      await api.updateTrailDetail(id, { ...existing, ...detail });
    }

    // Upsert imported trails into the existing local list (preserve unimported trails)
    const trailMap = new Map(_trails.map(t => [t.id, t]));
    for (const trail of importedTrails) {
      trailMap.set(trail.id, trail);
    }
    const mergedTrails = [...trailMap.values()];

    // Field-level merge imported details into existing (preserve unimported details)
    const mergedDetails = { ..._trailDetails };
    for (const [id, detail] of Object.entries(importedDetails)) {
      mergedDetails[id] = { ...mergedDetails[id], ...detail };
    }

    setState(mergedTrails, mergedDetails, false, _lookup, _schedule);
  }, []);

  return {
    trails: snapshot.trails,
    trailDetails: snapshot.trailDetails,
    loading: snapshot.loading,
    lookup: snapshot.lookup,
    schedule: snapshot.schedule,
    saveTrail,
    saveTrailDetail,
    deleteTrail,
    exportJSON,
    importJSON,
    setSchedule,
  };
}
