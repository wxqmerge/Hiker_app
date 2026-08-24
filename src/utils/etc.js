const START_HOUR = 8;
const START_MINUTE = 30;
const EARLY_START_MINUTE = 0;
const MIN_SPEED_MPH = 2.2;
const MAX_SPEED_MPH = 1.1;

export function calculateETC(distance, range, earlyStart, durationMinutes) {
  const dist = Math.max(distance || 0, 0);
  const travel = Math.max(range || 0, 0);
  const startMin = earlyStart ? EARLY_START_MINUTE : START_MINUTE;

  const minMinutes = (dist / MIN_SPEED_MPH) * 60;
  const maxMinutes = (dist / MAX_SPEED_MPH) * 60;
  const gpxMinutes = durationMinutes || 0;
  const hikeMinutes = gpxMinutes > 0
    ? Math.min(Math.max(gpxMinutes, minMinutes), maxMinutes)
    : minMinutes;

  const totalMinutes = Math.round(START_HOUR * 60 + startMin + hikeMinutes + travel * 2);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(mins).padStart(2, '0')} ${ampm}`;
}
