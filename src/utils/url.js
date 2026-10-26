import { formatDateCompact } from './dateUtils';

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
    const bdate = formatDateCompact(date);
    url += `&bdate=${bdate}`;
  }
  return url;
}

// Returns a URL safe for use in href/src, or '' when the scheme is not allowed.
// HTML escaping alone does not neutralize javascript:/data: URLs, so stored
// trail.webLink values must pass through this before reaching an <a href>.
export function safeWebLink(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Bare domains like "example.com/page" are treated as https links.
    try {
      parsed = new URL(`https://${trimmed}`);
    } catch {
      return '';
    }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:' && parsed.protocol !== 'mailto:') {
    return '';
  }
  return parsed.href;
}
