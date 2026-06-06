import { useState, useCallback } from 'react';

const TOOLTIPS_KEY = 'hiker-tooltips-enabled';

export function useTooltips() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(TOOLTIPS_KEY) !== 'false';
    } catch {
      return true;
    }
  });

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem(TOOLTIPS_KEY, next ? 'true' : 'false'); } catch {}
      return next;
    });
  }, []);

  const title = useCallback((text) => {
    return enabled ? text : undefined;
  }, [enabled]);

  return { enabled, toggle, title };
}
