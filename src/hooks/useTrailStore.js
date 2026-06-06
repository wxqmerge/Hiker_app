import { useState, useCallback, useRef, useEffect } from 'react';
import * as api from '../api/client.js';

let _trails = [];
let _trailDetails = {};
let _loading = true;
let _lookup = null;
let _schedule = null;
let _scheduleVersion = null;
let _subscribers = [];

function notifySubscribers() {
  _subscribers.forEach(fn => fn());
}

function setState(trails, details, loading, lookup, schedule) {
  _trails = trails;
  _trailDetails = details;
  _loading = loading;
  _lookup = lookup;
  _schedule = schedule;
  notifySubscribers();
}

export function setSchedule(schedule) {
  _schedule = schedule;
  notifySubscribers();
}

async function initSharedState() {
  try {
    const [trails, details, lookup, schedule] = await Promise.all([
      api.getTrails(),
      api.getTrailDetails(),
      api.getLookup(),
      api.getSchedule(),
    ]);
    setState(trails, details, false, lookup, schedule);
  } catch (error) {
    console.error('[useTrailStore] Failed to load data:', error);
    setState([], {}, false, null, null);
  }
}

initSharedState();

export function resetTrailStore() {
  _trails = [];
  _trailDetails = {};
  _loading = true;
  _lookup = null;
  _schedule = null;
  _scheduleVersion = null;
  _subscribers = [];
  initSharedState();
}

export function useTrailStore() {
  const mountedRef = useRef(true);

  const [state, setStateLocal] = useState(() => ({
    trails: [..._trails],
    trailDetails: { ..._trailDetails },
    loading: _loading,
    lookup: _lookup,
    schedule: _schedule,
  }));

  const subscribe = useCallback(() => {
    const sub = () => {
      if (mountedRef.current) setStateLocal({
        trails: _trails,
        trailDetails: _trailDetails,
        loading: _loading,
        lookup: _lookup,
        schedule: _schedule,
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
    try {
      await api.updateTrail(trail);
      const idx = _trails.findIndex(t => t.id === trail.id);
      let newTrails;
      if (idx >= 0) {
        newTrails = _trails.map(t => t.id === trail.id ? trail : t);
      } else {
        newTrails = [..._trails, trail];
      }
      setState(newTrails, _trailDetails, false, _lookup, _schedule);
    } catch (error) {
      console.error('[useTrailStore] saveTrail error:', error);
      throw error;
    }
  }, []);

  const saveTrailDetail = useCallback(async (trailId, detail) => {
    try {
      const existing = _trailDetails[trailId] || {};
      await api.updateTrailDetail(trailId, { ...existing, ...detail });
      const newDetails = { ..._trailDetails, [trailId]: { ...existing, ...detail } };
      setState([..._trails], newDetails, false, _lookup, _schedule);
    } catch (error) {
      console.error('[useTrailStore] saveTrailDetail error:', error);
      throw error;
    }
  }, []);

  const deleteTrail = useCallback(async (trailId) => {
    try {
      await api.deleteTrail(trailId);
      const newTrails = _trails.filter(t => t.id !== trailId);
      const newDetails = { ..._trailDetails };
      delete newDetails[trailId];
      setState(newTrails, newDetails, false, _lookup, _schedule);
    } catch (error) {
      console.error('[useTrailStore] deleteTrail error:', error);
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

    setState([...importedTrails], JSON.parse(JSON.stringify(importedDetails)), false, _lookup, _schedule);
  }, []);

  return {
    trails: state.trails,
    trailDetails: state.trailDetails,
    loading: state.loading,
    lookup: state.lookup,
    schedule: state.schedule,
    saveTrail,
    saveTrailDetail,
    deleteTrail,
    exportJSON,
    importJSON,
    setSchedule,
  };
}
