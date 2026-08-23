/**
 * Compute median hiking speed (mph) across trails that have both distance and duration.
 * @param {Array<{distance: number, durationMinutes: number}>} trails
 * @returns {number|null} Median speed in mph, or null if no valid data.
 */
export function computeMedianSpeed(trails) {
  const speeds = trails
    .filter((t) => t.distance > 0 && t.durationMinutes > 0)
    .map((t) => t.distance / (t.durationMinutes / 60));

  if (speeds.length === 0) return null;

  const sorted = [...speeds].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Format a speed in mph for display.
 * @param {number|null} speed
 * @returns {string}
 */
export function formatSpeed(speed) {
  if (speed == null) return 'N/A';
  return `${speed.toFixed(1)} mph`;
}
