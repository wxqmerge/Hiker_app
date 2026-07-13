const API_BASE = import.meta.env.VITE_API_BASE || '';

export function getApiBase() {
  if (API_BASE) return API_BASE;
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname;
  const path = window.location.pathname;
  if (hostname.endsWith('.example.com') && hostname.split('.').length > 2) {
    return `https://${hostname}`;
  }
  const match = path.match(/^\/([\w]+-[\w-]+)/);
  if (match) {
    return `https://${match[1]}.example.com`;
  }
  return '';
}

export function getHealthUrl() {
  const apiBase = getApiBase();
  if (apiBase) return `${apiBase}/health`;
  if (typeof window === 'undefined') return '/health';
  const hostname = window.location.hostname;
  const path = window.location.pathname;
  if (hostname.endsWith('.example.com')) {
    return `https://${hostname}/health`;
  }
  const match = path.match(/^\/([\w]+-[\w-]+)/);
  if (match) {
    return `https://${match[1]}.example.com/health`;
  }
  return '/health';
}

export function getGoogleAllTrailsSearchUrl(trailName) {
  if (!trailName) return '';
  const query = encodeURIComponent(`alltrails.com+washington+${trailName}`);
  return `https://www.google.com/search?q=${query}`;
}
