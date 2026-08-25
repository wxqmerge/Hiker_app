const START_HOUR = 8;
const START_MINUTE = 30;
const MIN_SPEED_MPH = 2.2;
const MAX_SPEED_MPH = 1.1;

export const START_OFFSET_OPTIONS = [
  { value: 0, label: '8:30 AM' },
  { value: -30, label: '8:00 AM (30m early)' },
  { value: -60, label: '7:30 AM (60m early)' },
  { value: -90, label: '7:00 AM (90m early)' },
  { value: 30, label: '9:00 AM (30m late)' },
];

export function getEtcBounds(distance) {
  const dist = Math.max(distance || 0, 0);
  return {
    minMinutes: (dist / MIN_SPEED_MPH) * 60,
    maxMinutes: (dist / MAX_SPEED_MPH) * 60,
  };
}

export function clampHikeMinutes(distance, durationMinutes) {
  const { minMinutes, maxMinutes } = getEtcBounds(distance);
  const gpxMinutes = durationMinutes || 0;
  if (gpxMinutes <= 0) return { minutes: minMinutes, source: 'min' };
  if (gpxMinutes < minMinutes) return { minutes: minMinutes, source: 'min' };
  if (gpxMinutes > maxMinutes) return { minutes: maxMinutes, source: 'max' };
  return { minutes: gpxMinutes, source: 'gpx' };
}

/**
 * Normalize early_start value for backward compatibility.
 * true → -30, false → 0, number → as-is.
 */
export function normalizeStartOffset(earlyStart) {
  if (earlyStart === true) return -30;
  if (earlyStart === false || earlyStart == null) return 0;
  return Number(earlyStart) || 0;
}

export function calculateETC(distance, range, earlyStart, durationMinutes) {
  const travel = Math.max(range || 0, 0);
  const offset = normalizeStartOffset(earlyStart);
  const startTotal = START_HOUR * 60 + START_MINUTE + offset;
  const { minutes: hikeMinutes } = clampHikeMinutes(distance, durationMinutes);

  const totalMinutes = Math.round(startTotal + hikeMinutes + travel * 2);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(mins).padStart(2, '0')} ${ampm}`;
}
