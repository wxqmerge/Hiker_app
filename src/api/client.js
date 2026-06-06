export const API_BASE = import.meta.env.VITE_API_BASE || '';

export function getApiBase() {
  if (API_BASE) return API_BASE;
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname;
  const path = window.location.pathname;
  // Direct subdomain: sothh-app.example.com → https://sothh-app.example.com
  if (hostname.endsWith('.example.com') && hostname.split('.').length > 2) {
    return `https://${hostname}`;
  }
  // Path-based: example.com/sothh-dev → https://sothh-dev.example.com
  const match = path.match(/^\/(sothh-[\w-]+)/);
  if (match) {
    return `https://${match[1]}.example.com`;
  }
  return '';
}

async function request(path, options = {}) {
  const apiBase = getApiBase();
  const url = `${apiBase}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (options.apiKey) {
    headers['X-API-Key'] = localStorage.getItem('hiker-api-key') || '';
  }

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(error.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return {
    ...data,
    _etag: res.headers?.get('etag') || null,
    _status: res.status,
  };
}

export async function getTrails() {
  const data = await request('/api/trails');
  return data.trails || [];
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
  const data = await request('/api/trails/details');
  const { _etag: _, _status: __, ...rest } = data;
  return rest;
}

export async function updateTrailDetail(id, detail) {
  return request(`/api/trails/details/${id}`, {
    method: 'PUT',
    body: detail,
    apiKey: true,
  });
}

export async function getLookup() {
  const data = await request('/api/lookup');
  const { _etag: _, _status: __, ...rest } = data;
  return rest;
}

export async function getSchedule() {
  const data = await request('/api/schedule');
  const { _etag: _, _status: __, ...rest } = data;
  return rest;
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

  const apiKey = localStorage.getItem('hiker-api-key');
  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/schedule/import-xls`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey || '',
    },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: 'Import failed' } }));
    throw new Error(error.error?.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function importTrailsFromXls(file) {
  const formData = new FormData();
  formData.append('file', file);

  const apiKey = localStorage.getItem('hiker-api-key');
  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/schedule/import-trails-xls`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey || '',
    },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: 'Import failed' } }));
    throw new Error(error.error?.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function getScheduleHistory() {
  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/schedule/history`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(error.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function restoreSchedule(timestamp) {
  return request('/api/schedule/history/restore', {
    method: 'POST',
    body: { timestamp },
    apiKey: true,
  });
}
