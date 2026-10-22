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

function getRawHash() {
  if (typeof window === 'undefined') return '';
  const hash = window.location?.hash;
  if (typeof hash === 'string' && hash) return hash.replace(/^#/, '');
  const href = window.location?.href || '';
  const hashIndex = href.indexOf('#');
  return hashIndex >= 0 ? href.slice(hashIndex + 1) : '';
}

function getHashParam(name) {
  const raw = getRawHash();
  if (!raw) return '';
  const queryStart = raw.indexOf('?');
  const query = queryStart >= 0 ? raw.slice(queryStart + 1) : raw;
  return new URLSearchParams(query).get(name) || '';
}

export function getApiKeyFromHash() {
  return getHashParam('apikey') || getHashParam('key');
}

export function hasPendingApiKeyFromHash() {
  return getApiKeyFromHash().trim().length > 0;
}

export function removeApiKeyFromLocation() {
  if (typeof window === 'undefined') return;
  const href = window.location?.href || '';
  const hashIndex = href.indexOf('#');
  if (hashIndex < 0) return;

  const base = href.slice(0, hashIndex);
  const rawHash = href.slice(hashIndex + 1);
  const queryStart = rawHash.indexOf('?');
  const prefix = queryStart >= 0 ? rawHash.slice(0, queryStart) : '';
  const query = queryStart >= 0 ? rawHash.slice(queryStart + 1) : rawHash;
  const params = new URLSearchParams(query);
  params.delete('apikey');
  params.delete('key');
  const remaining = params.toString();
  const nextHash = prefix + (remaining ? `?${remaining}` : '');
  window.history.replaceState({}, '', base + (nextHash ? `#${nextHash}` : ''));
}
