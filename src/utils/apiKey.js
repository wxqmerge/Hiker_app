export const API_KEY_STORAGE_KEY = 'hiker-api-key';

const listeners = new Set();

export function getStoredApiKey() {
  return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
}

export function hasStoredApiKey() {
  return getStoredApiKey().trim().length > 0;
}

export function storeApiKey(key) {
  if (key && key.trim().length > 0) {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
  } else {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  }
  listeners.forEach((fn) => fn());
}

export function subscribeApiKeyChange(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
