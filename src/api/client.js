const API_BASE = import.meta.env.VITE_API_BASE || '';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
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

  return res.json();
}

export async function getTrails() {
  const data = await request('/api/trails');
  return data.trails || [];
}

export async function getTrailById(id) {
  return request(`/api/trails/${id}`);
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
  return request('/api/trails/details');
}

export async function getTrailDetailById(id) {
  return request(`/api/trails/details/${id}`);
}

export async function updateTrailDetail(id, detail) {
  return request(`/api/trails/details/${id}`, {
    method: 'PUT',
    body: detail,
    apiKey: true,
  });
}

export async function getLookup() {
  return request('/api/lookup');
}

export async function getSchedule() {
  return request('/api/schedule');
}

export async function uploadSchedule(file) {
  const formData = new FormData();
  formData.append('file', file);

  const apiKey = localStorage.getItem('hiker-api-key');
  const res = await fetch(`${API_BASE}/api/schedule/upload`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey || '',
    },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: 'Upload failed' } }));
    throw new Error(error.error?.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function getScheduleReport(quarter) {
  const res = await fetch(`${API_BASE}/api/schedule/report?quarter=${quarter}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function getScheduleDownload(quarter) {
  const res = await fetch(`${API_BASE}/api/schedule/download?quarter=${quarter}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
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
  const res = await fetch(`${API_BASE}/api/schedule/import-xls`, {
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
  const res = await fetch(`${API_BASE}/api/schedule/import-trails-xls`, {
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
  return request('/api/schedule/history');
}

export async function restoreSchedule(timestamp) {
  return request('/api/schedule/history/restore', {
    method: 'POST',
    body: { timestamp },
    apiKey: true,
  });
}
