// Shared constants

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const MONTH_ABBR_TO_FULL = Object.fromEntries(
  MONTH_ABBR.map((abbr, i) => [abbr, MONTH_NAMES[i]])
);

export const MONTH_FULL_TO_ABBR = Object.fromEntries(
  MONTH_NAMES.map((name, i) => [name, MONTH_ABBR[i]])
);

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DEFAULT_FILTERS = {
  search: '',
  distance: { min: 0, max: 20 },
  elevation: { min: 0, max: 5000 },
  difficulties: [],
  months: [],
  sortBy: 'name',
  wilderness: false,
  gpx: 'all'
};

export const DIFFICULTY_COLORS = {
  'Easy': 'bg-green-200 text-green-900',
  'Easy to Mod': 'bg-lime-200 text-lime-900',
  'Moderate': 'bg-yellow-200 text-yellow-900',
  'Mod to Diff': 'bg-orange-200 text-orange-900',
  'Difficult': 'bg-red-200 text-red-900'
};

export const NAV_LINKS = [
  { to: '/', label: 'Calendar' },
  { to: '/browse', label: 'Browse Trails' },
  { to: '/trails', label: 'Trail Manager' },
  { to: '/schedule', label: 'Schedule Builder' },
];
