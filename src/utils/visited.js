const VISITED_KEY = 'hiker-has-visited';

export function hasVisited() {
  return localStorage.getItem(VISITED_KEY) === '1';
}

export function markVisited() {
  localStorage.setItem(VISITED_KEY, '1');
}
