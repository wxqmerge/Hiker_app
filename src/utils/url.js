const API_BASE = import.meta.env.VITE_API_BASE || '';

function getParentDomain() {
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  if (parts.length > 2) {
    return parts.slice(-2).join('.');
  }
  return hostname;
}

export function getApiBase() {
  if (API_BASE) return API_BASE;
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return '';
  const path = window.location.pathname;
  const parentDomain = getParentDomain();
  if (hostname !== parentDomain) {
    return `https://${hostname}`;
  }
  const pathMatch = path.match(/^\/([\w][\w-]*)(\/|$)/);
  if (pathMatch) {
    return `https://${pathMatch[1]}.${parentDomain}`;
  }
  return '';
}

export function getGoogleAllTrailsSearchUrl(trailName) {
  if (!trailName) return '';
  const query = encodeURIComponent(`alltrails.com+washington+${trailName}`);
  return `https://www.google.com/search?q=${query}`;
}

export function getNoaaTideUrl(stationId, date) {
  let url = `https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=${stationId}`;
  if (date) {
    const bdate = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    url += `&bdate=${bdate}`;
  }
  return url;
}
