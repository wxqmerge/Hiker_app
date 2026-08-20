const API_KEY_STORAGE_KEY = 'hiker-api-key';

export function getStoredApiKey() {
  return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
}

export function hasStoredApiKey() {
  return getStoredApiKey().trim().length > 0;
}
