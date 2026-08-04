import { useState, useCallback, useRef, useEffect } from 'react';
import * as api from '../api/client.js';
import { getTrailName } from '../utils/data';

let _trails = [];
let _trailDetails = {};
let _loading = true;
let _lookup = null;
let _schedule = null;
let _scheduleVersion = null;
let _subscribers = [];

// Version counters for cheap change detection
let _trailsVer = 0;
let _detailsVer = 0;
let _scheduleVer = 0;
let _lookupVer = 0;

function notifySubscribers(changed) {
  _subscribers.forEach(fn => fn(changed));
}

function setState(trails, details, loading, lookup, schedule) {
  _trails = trails;
  _trailsVer++;
  _trailDetails = details;
  _detailsVer++;
  _loading = loading;
  _lookup = lookup;
  _lookupVer++;
  _schedule = schedule;
  _scheduleVer++;
  notifySubscribers('all');
}

export function setSchedule(schedule) {
  _schedule = schedule;
  _scheduleVer++;
  notifySubscribers('schedule');
}

export function getSchedule() {
  return _schedule;
}

function setTrails(trails) {
  _trails = trails;
  _trailsVer++;
  notifySubscribers('trails');
}

function setTrailDetails(details) {
  _trailDetails = details;
  _detailsVer++;
  notifySubscribers('details');
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
    setState([], {}, true, null, null);
  }
}

initSharedState();

export function resetTrailStore() {
  _trails = [];
  _trailsVer++;
  _trailDetails = {};
  _detailsVer++;
  _loading = true;
  _lookup = null;
  _lookupVer++;
  _schedule = null;
  _scheduleVer++;
  _scheduleVersion = null;
  _subscribers = [];
  initSharedState();
}

export function useTrailStore() {
  const mountedRef = useRef(true);
  const verRef = useRef({ trails: 0, details: 0, schedule: 0, lookup: 0 });

  const [state, setStateLocal] = useState(() => ({
    trails: [..._trails],
    trailDetails: { ..._trailDetails },
    loading: _loading,
    lookup: _lookup,
    schedule: _schedule,
  }));

  const subscribe = useCallback(() => {
    verRef.current = { trails: _trailsVer, details: _detailsVer, schedule: _scheduleVer, lookup: _lookupVer };
    const sub = (changed) => {
      if (!mountedRef.current) return;
      const v = verRef.current;
      if (changed === 'schedule' && v.schedule === _scheduleVer) return;
      if (changed === 'trails' && v.trails === _trailsVer) return;
      if (changed === 'details' && v.details === _detailsVer) return;
      if (changed === 'all' && v.trails === _trailsVer && v.details === _detailsVer && v.lookup === _lookupVer && v.schedule === _scheduleVer) return;
      verRef.current = { trails: _trailsVer, details: _detailsVer, schedule: _scheduleVer, lookup: _lookupVer };
      setStateLocal({
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
        newTrails = [..._trails, trail].sort((a, b) => getTrailName(a).localeCompare(getTrailName(b)));
      }
      setTrails(newTrails);
      return trail;
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
      setTrailDetails(newDetails);
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
      _trails = newTrails;
      _trailsVer++;
      _trailDetails = newDetails;
      _detailsVer++;
      notifySubscribers('all');
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
