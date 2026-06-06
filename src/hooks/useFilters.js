import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { filterTrails, sortTrails } from '../utils/filterTrails';
import { DEFAULT_FILTERS } from '../utils/constants';

let _filters = { ...DEFAULT_FILTERS };
let _subscribers = [];

export function resetFiltersStore() {
  _filters = { ...DEFAULT_FILTERS };
  _subscribers = [];
  // Note: setState not called because subscribers are cleared.
  // Components will re-subscribe on mount and read fresh _filters.
}

function setState(filters) {
  _filters = filters;
  _subscribers.forEach(fn => fn());
}


function useFiltersStore() {
  const mountedRef = useRef(true);

  const [state, setStateLocal] = useState(() => ({
    filters: _filters,
  }));

  const subscribe = useCallback(() => {
    const sub = () => {
      if (mountedRef.current) setStateLocal({ filters: _filters });
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

  const setFilters = useCallback((next) => {
    const updated = typeof next === 'function' ? next(_filters) : next;
    setState(updated);
  }, []);

  const resetFilters = useCallback(() => {
    setState({ ...DEFAULT_FILTERS });
  }, []);

  return {
    filters: state.filters,
    setFilters,
    resetFilters,
  };
}

export function useFilters(trails, trailDetails) {
  const { filters, setFilters, resetFilters } = useFiltersStore();

  const filteredTrails = useMemo(() => filterTrails(trails, filters, trailDetails), [trails, filters, trailDetails]);
  const sortedTrails = useMemo(() => sortTrails(filteredTrails, filters, 'name', trailDetails), [filteredTrails, filters, trailDetails]);

  return { filters, setFilters, sortedTrails, resetFilters };
}
