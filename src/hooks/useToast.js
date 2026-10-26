const listeners = new Set();

// Non-hook version so plain (non-React) modules can raise a toast too.
export function showToast(message, type = 'info') {
  listeners.forEach(fn => fn({ id: Date.now() + Math.random(), message, type }));
}

export function useToast() {
  return showToast;
}

export const getToastListeners = () => listeners;
