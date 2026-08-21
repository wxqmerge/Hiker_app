export function validateGpxContent(content: string): boolean {
  if (content.length < 100) return false;
  if (!content.includes('<?xml') || !content.includes('<gpx')) return false;
  if (!content.includes('<trkpt') && !content.includes('<wpt') && !content.includes('<rtept')) return false;
  return true;
}

const SAFE_GPX_FILENAME = /^[\w.-]+\.gpx$/;

export function isSafeGpxFilename(name: string): boolean {
  if (!name || name.includes('..')) return false;
  return SAFE_GPX_FILENAME.test(name);
}
