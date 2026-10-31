import { getApiBase } from '../utils/url.js';
import { getStoredApiKey } from '../utils/apiKey';

export async function request(path, options = {}) {
  const apiBase = getApiBase();
  const url = `${apiBase}${path}`;
  const headers = { ...options.headers };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.apiKey) {
    headers['X-API-Key'] = getStoredApiKey();
  }

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: 'Request failed' } }));
    const errMsg = error.error?.message || `HTTP ${res.status}`;
    if (options.throwOnError !== false) {
      const err = new Error(errMsg);
      err.status = res.status;
      const errEtag = res.headers?.get('etag');
      if (errEtag) err.etag = errEtag;
      throw err;
    }
    return { error: errMsg, status: res.status };
  }

  let data;
  const responseType = options.responseType || 'json';
  if (responseType === 'blob') {
    data = await res.blob();
  } else if (responseType === 'text') {
    data = await res.text();
  } else {
    data = await res.json();
    if (options.stripMetadata) {
      const { _etag: _, _status: __, ...rest } = data;
      data = rest;
    } else if (!Array.isArray(data)) {
      data = {
        ...data,
        _etag: res.headers?.get('etag') || null,
        _status: res.status,
      };
    }
  }

  return data;
}

export async function verifyAdminKey(apiKey) {
  const key = String(apiKey || '').trim();
  const headers = {};
  if (key) headers['X-API-Key'] = key;

  let res;
  try {
    res = await fetch(`${getApiBase()}/api/auth/verify`, { headers });
  } catch {
    return { valid: false, reason: 'network', error: 'Unable to reach the server.' };
  }

  if (res.status === 200 || res.status === 204) return { valid: true };
  if (res.status === 401) return { valid: false, reason: 'invalid' };
  if (res.status === 403) return { valid: false, reason: 'not-configured' };

  const data = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
  const message = data.error?.message || `HTTP ${res.status}`;
  if (res.status === 429) return { valid: false, reason: 'rate-limited', error: message };

  throw new Error(message);
}

export async function getTrails() {
  const data = await request('/api/trails');
  return data.trails || [];
}

// Bounded LRU of fetched GPX bodies. Entries must be evicted whenever the
// server-side file changes (upload/delete), otherwise a session keeps
// downloading stale tracks after a re-upload.
const gpxCache = new Map();
const GPX_CACHE_MAX = 20;

function gpxCacheSet(trailId, value) {
  gpxCache.delete(trailId);
  gpxCache.set(trailId, value);
  if (gpxCache.size > GPX_CACHE_MAX) {
    gpxCache.delete(gpxCache.keys().next().value);
  }
}

export function invalidateGpxCache(trailId) {
  gpxCache.delete(trailId);
}

export async function getGpx(trailId) {
  if (gpxCache.has(trailId)) {
    const cached = gpxCache.get(trailId);
    gpxCacheSet(trailId, cached); // mark most-recently-used
    return cached;
  }
  try {
    const result = await request(`/api/trails/gpx/${trailId}`, { responseType: 'text' });
    gpxCacheSet(trailId, result);
    return result;
  } catch (err) {
    if (err.status === 404) {
      gpxCacheSet(trailId, null);
      return null;
    }
    throw err;
  }
}

export async function uploadGpxFile(trailId, file) {
  const formData = new FormData();
  formData.append('gpx', file);
  const result = await request(`/api/trails/gpx/${trailId}`, {
    method: 'POST',
    body: formData,
    apiKey: true,
  });
  invalidateGpxCache(trailId);
  gpxCache.delete(trailId);
  return result;
}

export async function resyncGpxCoords() {
  return request('/api/trails/resync-gpx-coords', {
    method: 'POST',
    apiKey: true,
  });
}

export async function updateTrail(trail) {
  return request(`/api/trails/${trail.id}`, {
    method: 'PUT',
    body: trail,
    apiKey: true,
  });
}

export async function deleteTrail(id) {
  const result = await request(`/api/trails/${id}`, {
    method: 'DELETE',
    apiKey: true,
  });
  gpxCache.delete(id);
  return result;
}

export async function getTrailDetails() {
  return request('/api/trails/details', { stripMetadata: true });
}

export async function updateTrailDetail(id, detail) {
  return request(`/api/trails/details/${id}`, {
    method: 'PUT',
    body: detail,
    apiKey: true,
  });
}

export async function getLookup() {
  return request('/api/lookup', { stripMetadata: true });
}

export async function getSchedule() {
  const data = await request('/api/schedule');
  if (data && data._etag) currentScheduleEtag = data._etag;
  const { _etag, _status, ...rest } = data;
  return rest;
}

// ETag of the most recently seen server schedule. Sent as If-Match on saves so
// a stale editor gets 412 instead of silently overwriting newer server state.
let currentScheduleEtag = null;

export function setScheduleEtag(etag) {
  currentScheduleEtag = etag || null;
}

export function getScheduleEtag() {
  return currentScheduleEtag;
}

function getScheduleEntryCount(schedule) {
  if (!schedule || typeof schedule !== 'object') return 0;
  return Object.values(schedule).reduce((sum, entries) => sum + (Array.isArray(entries) ? entries.length : 0), 0);
}

export async function updateSchedule(schedule, { confirmEmpty = false } = {}) {
  if (getScheduleEntryCount(schedule) === 0 && !confirmEmpty) {
    throw new Error('Refusing to save an empty schedule. Use an explicit clear action to confirm.');
  }
  const headers = {};
  if (confirmEmpty) headers['X-Confirm-Empty'] = 'true';
  if (currentScheduleEtag) headers['If-Match'] = currentScheduleEtag;
  try {
    const result = await request('/api/schedule', {
      method: 'PUT',
      body: schedule,
      apiKey: true,
      headers: Object.keys(headers).length ? headers : undefined,
    });
    if (result && result.etag) currentScheduleEtag = result.etag;
    return result;
  } catch (err) {
    // On 412 the server sends the current ETag; adopt it so a fresh reload +
    // retry sends the right precondition instead of failing in a loop.
    if (err.status === 412 && err.etag) currentScheduleEtag = err.etag;
    throw err;
  }
}

export async function getScheduleHistory() {
  return request('/api/schedule/history', { apiKey: true });
}

export async function restoreSchedule(timestamp) {
  const result = await request('/api/schedule/history/restore', {
    method: 'POST',
    body: { timestamp },
    apiKey: true,
  });
  if (result && result.etag) currentScheduleEtag = result.etag;
  return result;
}

export async function ensureScheduleWritable() {
  try {
    return await request('/api/schedule/ensure-writable', { method: 'POST', apiKey: true });
  } catch {
    console.warn('[CLIENT] Failed to ensure schedule files are writable');
    return null;
  }
}

export async function reloadSchedule() {
  return request('/api/schedule/reload', {
    method: 'POST',
    apiKey: true,
  });
}

export async function exportDataZip() {
  return request('/api/data/export-zip', { responseType: 'blob', apiKey: true });
}

export async function importDataZip(file) {
  const formData = new FormData();
  formData.append('zip', file);
  return request('/api/data/import-zip', {
    method: 'POST',
    body: formData,
    apiKey: true,
  });
}
