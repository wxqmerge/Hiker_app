import { getApiBase } from '../utils/url.js';
export { getApiBase };

export async function request(path, options = {}) {
  const apiBase = getApiBase();
  const url = `${apiBase}${path}`;
  const headers = { ...options.headers };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.apiKey) {
    headers['X-API-Key'] = localStorage.getItem('hiker-api-key') || '';
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
      throw new Error(errMsg);
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
    } else {
      data = {
        ...data,
        _etag: res.headers?.get('etag') || null,
        _status: res.status,
      };
    }
  }

  return data;
}

export async function getTrails() {
  const data = await request('/api/trails');
  return data.trails || [];
}

export async function getGpx(trailId) {
  try {
    return await request(`/api/trails/gpx/${trailId}`, { responseType: 'text' });
  } catch (err) {
    if (err.message.includes('HTTP 404')) return null;
    throw err;
  }
}

export async function uploadGpxFile(trailId, file) {
  const formData = new FormData();
  formData.append('gpx', file);
  return request(`/api/trails/gpx/${trailId}`, {
    method: 'POST',
    body: formData,
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
  return request(`/api/trails/${id}`, {
    method: 'DELETE',
    apiKey: true,
  });
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
  return request('/api/schedule', { stripMetadata: true });
}

export async function updateSchedule(schedule) {
  return request('/api/schedule', {
    method: 'PUT',
    body: schedule,
    apiKey: true,
  });
}

export async function importScheduleFromXls(file) {
  const formData = new FormData();
  formData.append('file', file);
  return request('/api/schedule/import-xls', {
    method: 'POST',
    body: formData,
    apiKey: true,
  });
}

export async function importTrailsFromXls(file) {
  const formData = new FormData();
  formData.append('file', file);
  return request('/api/schedule/import-trails-xls', {
    method: 'POST',
    body: formData,
    apiKey: true,
  });
}

export async function getScheduleHistory() {
  return request('/api/schedule/history');
}

export async function restoreSchedule(timestamp) {
  return request('/api/schedule/history/restore', {
    method: 'POST',
    body: { timestamp },
    apiKey: true,
  });
}

export async function ensureScheduleWritable() {
  try {
    return await request('/api/schedule/ensure-writable');
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
  return request('/api/data/export-zip', { responseType: 'blob' });
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
