import { useRef, useEffect, useCallback } from 'react';
import * as api from '../api/client.js';

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

export function useSchedulePolling(scheduleStore, pollingInterval = 5000) {
  const prevScheduleRef = useRef(null);
  const isSavingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    isSavingRef.current = false;
    return () => { mountedRef.current = false; };
  }, []);

  const pollSchedule = useCallback(async () => {
    if (isSavingRef.current || !mountedRef.current) return;

    try {
      const response = await fetch(api.API_BASE ? `${api.API_BASE}/api/schedule` : '/api/schedule');

      if (response.status === 304) {
        return;
      }

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (!mountedRef.current) return;

      if (!deepEqual(data, prevScheduleRef.current)) {
        prevScheduleRef.current = data;
        scheduleStore.setSchedule(data);
      }
    } catch {
      // Network error, ignore during polling
    }
  }, [scheduleStore]);

  useEffect(() => {
    const interval = setInterval(pollSchedule, pollingInterval);
    return () => clearInterval(interval);
  }, [pollSchedule, pollingInterval]);
}
