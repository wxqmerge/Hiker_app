// Extract hike duration from GPX content by parsing <time> elements in <trkpt>.
// Returns the total duration in minutes and a human-readable formatted string,
// or null if fewer than two time points are present.
export function extractDurationFromGpxContent(content: string): { minutes: number; formatted: string } | null {
  const timePattern = /<trkpt[^>]*>[\s\S]*?<time>([^<]+)<\/time>/g;
  const times: string[] = [];
  let match;
  while ((match = timePattern.exec(content)) !== null) {
    times.push(match[1]);
  }

  if (times.length < 2) return null;

  try {
    const firstTime = new Date(times[0]);
    const lastTime = new Date(times[times.length - 1]);
    if (isNaN(firstTime.getTime()) || isNaN(lastTime.getTime())) return null;
    const durationMs = lastTime.getTime() - firstTime.getTime();
    if (isNaN(durationMs)) return null;
    const minutes = Math.max(0, Math.round(durationMs / 60000));

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const formatted = hours > 0
      ? `${hours}h ${mins}m`
      : `${mins}m`;

    return { minutes, formatted };
  } catch {
    return null;
  }
}
