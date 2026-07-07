import { useCallback } from 'react';

const listeners = new Set();

export function useToast() {
  const show = useCallback((message, type = 'info') => {
    listeners.forEach(fn => fn({ id: Date.now() + Math.random(), message, type }));
  }, []);
  return show;
}

export const getToastListeners = () => listeners;
