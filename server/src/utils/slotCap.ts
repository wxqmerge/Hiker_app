// Single parser for MAX_HIKES_PER_DAY so the public config and the write-boundary
// slot validation can never disagree. Default 3, clamped to 1..7.
export function parseMaxHikesPerDay(): number {
  return Math.min(7, Math.max(1, parseInt(process.env.MAX_HIKES_PER_DAY || '3', 10) || 3));
}
