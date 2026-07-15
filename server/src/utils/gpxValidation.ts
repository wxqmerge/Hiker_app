export function validateGpxContent(content: string): boolean {
  if (content.length < 100) return false;
  if (!content.includes('<?xml') || !content.includes('<gpx')) return false;
  if (!content.includes('<trkpt') && !content.includes('<wpt') && !content.includes('<rtept')) return false;
  return true;
}
