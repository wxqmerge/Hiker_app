export function validateGpxContent(content: string): string | null {
  if (content.length < 100) return `GPX file too small (${content.length} bytes) - likely corrupted`;
  if (!content.includes('<?xml') || !content.includes('<gpx')) return 'Invalid GPX file - missing XML header or GPX root element';
  if (!content.includes('<trkpt') && !content.includes('<wpt') && !content.includes('<rtept')) return 'Invalid GPX file - no GPS coordinates found (needs trkpt, wpt, or rtept)';
  return null;
}

const SAFE_GPX_FILENAME = /^[\w.-]+\.gpx$/;

export function isSafeGpxFilename(name: string): boolean {
  if (!name || name.includes('..')) return false;
  return SAFE_GPX_FILENAME.test(name);
}
