import { useRef, useEffect, useCallback } from 'react';

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
  const prevDataRef = useRef(null);
  const etagRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const pollSchedule = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const headers = {};
      if (etagRef.current) {
        headers['If-None-Match'] = etagRef.current;
      }

      const response = await fetch('/api/schedule', { headers });

      if (response.status === 304) {
        return;
      }

      if (!response.ok) {
        return;
      }

      const newEtag = response.headers.get('etag');
      if (newEtag) {
        etagRef.current = newEtag;
      }

      const data = await response.json();
      if (!mountedRef.current) return;

      if (!deepEqual(data, prevDataRef.current)) {
        prevDataRef.current = data;
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
