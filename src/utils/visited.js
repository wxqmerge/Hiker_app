const VISITED_KEY = 'hiker-has-visited';

// localStorage access can throw (Safari private mode, blocked storage):
// treat "unavailable" as "not visited" rather than crashing app bootstrap.
export function hasVisited() {
  try {
    return localStorage.getItem(VISITED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markVisited() {
  try {
    localStorage.setItem(VISITED_KEY, '1');
  } catch {
    // ignore
  }
}
