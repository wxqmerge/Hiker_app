// Mirrors client-side getFirstCoordinateFromGpx (src/utils/io.js) which uses DOMParser.
// Server uses regex because Node has no DOM. Keep trkpt → wpt → rtept fallback order in sync.
// Attribute order is not guaranteed in XML, so lat/lon are extracted independently.
function extractLatLon(tag: string | undefined): { lat: number; lon: number } | null {
  if (!tag) return null;
  const latMatch = tag.match(/\blat="([^"]+)"/);
  const lonMatch = tag.match(/\blon="([^"]+)"/);
  if (!latMatch || !lonMatch) return null;
  const lat = parseFloat(latMatch[1]);
  const lon = parseFloat(lonMatch[1]);
  if (isNaN(lat) || isNaN(lon)) return null;
  return { lat, lon };
}

export function extractFirstCoordinateFromGpx(gpxContent: string): { lat: number; lon: number } | null {
  // Try trkpt first
  const trkpt = gpxContent.match(/<trkpt\b[^>]*\/?>/);
  const trkptCoord = extractLatLon(trkpt?.[0]);
  if (trkptCoord) return trkptCoord;
  // Fallback to wpt
  const wpt = gpxContent.match(/<wpt\b[^>]*\/?>/);
  const wptCoord = extractLatLon(wpt?.[0]);
  if (wptCoord) return wptCoord;
  // Fallback to rtept
  const rtept = gpxContent.match(/<rtept\b[^>]*\/?>/);
  return extractLatLon(rtept?.[0]);
}
