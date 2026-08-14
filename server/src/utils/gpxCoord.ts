export function extractFirstCoordinateFromGpx(gpxContent: string): { lat: number; lon: number } | null {
  // Try trkpt first
  const trkpt = gpxContent.match(/<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"\/?>/);
  if (trkpt) {
    const lat = parseFloat(trkpt[1]);
    const lon = parseFloat(trkpt[2]);
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }
  // Fallback to wpt
  const wpt = gpxContent.match(/<wpt\s+lat="([^"]+)"\s+lon="([^"]+)"\/?>/);
  if (wpt) {
    const lat = parseFloat(wpt[1]);
    const lon = parseFloat(wpt[2]);
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }
  // Fallback to rtept
  const rtept = gpxContent.match(/<rtept\s+lat="([^"]+)"\s+lon="([^"]+)"\/?>/);
  if (rtept) {
    const lat = parseFloat(rtept[1]);
    const lon = parseFloat(rtept[2]);
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }
  return null;
}
