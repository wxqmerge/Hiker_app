import { useRef, useEffect, useCallback } from 'react';
import { getApiBase } from '../utils/url.js';
import { deepEqual } from '../utils/object.js';
import { setScheduleEtag, isScheduleSaveInFlight } from '../api/client.js';

export function useSchedulePolling(scheduleStore, pollingInterval = 5000) {
  const prevDataRef = useRef(null);
  const etagRef = useRef(null);
  const serverVersionRef = useRef(null);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const pollSchedule = useCallback(async () => {
    if (!mountedRef.current) return;
    if (inFlightRef.current) return;
    // A save in flight changes the server version mid-request; a GET issued
    // now can answer from pre-save state and poison the If-Match precondition.
    if (isScheduleSaveInFlight()) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    inFlightRef.current = true;

    try {
      const startedAt = Date.now();
      const headers = {};
      if (etagRef.current) {
        headers['If-None-Match'] = etagRef.current;
      }

      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/api/schedule`, { headers });

      if (response.status === 304) {
        return;
      }

      if (!response.ok) {
        return;
      }

      const newEtag = response.headers.get('etag');
      const newVersion = response.headers.get('x-build-version');

      if (newVersion) {
        if (serverVersionRef.current && newVersion !== serverVersionRef.current) {
          console.warn('[Schedule] Version mismatch! Server:', newVersion, 'Client was on:', serverVersionRef.current);
        }
        serverVersionRef.current = newVersion;
      }

      if (newEtag) {
        etagRef.current = newEtag;
        // Keep the save-path precondition (If-Match) current even when the
        // data itself is unchanged and setSchedule is skipped. The client
        // ignores this when the GET raced a completed save.
        setScheduleEtag(newEtag, { startedAt });
      }

      const data = await response.json();
      if (!mountedRef.current) return;

      if (!deepEqual(data, prevDataRef.current)) {
        prevDataRef.current = data;
        scheduleStore.setSchedule(data);
      }
    } catch {
      // Network error, ignore during polling
    } finally {
      inFlightRef.current = false;
    }
  }, [scheduleStore]);

  useEffect(() => {
    const interval = setInterval(pollSchedule, pollingInterval);
    return () => clearInterval(interval);
  }, [pollSchedule, pollingInterval]);

  // Backgrounded PWAs get their timers frozen, so the interval above cannot
  // self-heal a failed startup fetch. Poll as soon as the app becomes visible.
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) pollSchedule();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pollSchedule]);
}
