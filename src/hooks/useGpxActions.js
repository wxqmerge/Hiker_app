import { useState, useCallback } from 'react';
import { getGpx } from '../api/client';
import { downloadBlob, getFirstCoordinateFromGpx, openGoogleMapsTrailhead, sanitizeFilename } from '../utils/io';
import { getTrailName } from '../utils/data';

export function useGpxActions(options, showToast) {
  const { trail, trailId, trailName } = typeof options === 'object' && options?.id ? { trail: options } : { trail: null, trailId: options, trailName };
  const [gpxDownloading, setGpxDownloading] = useState(false);

  const handleGpxDownload = useCallback(async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const id = trail?.id || trailId;
    if (!id || gpxDownloading) return;
    setGpxDownloading(true);
    try {
      const gpx = await getGpx(id);
      if (gpx) {
        const safeName = sanitizeFilename(getTrailName(trail) || trailName || 'route');
        downloadBlob(gpx, `${safeName}.gpx`, 'application/gpx+xml');
      }
    } finally {
      setTimeout(() => setGpxDownloading(false), 1000);
    }
  }, [trail, trailId, trailName, gpxDownloading]);

  const handleTrailhead = useCallback(async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const id = trail?.id || trailId;
    if (!id) return;
    try {
      const gpx = await getGpx(id);
      if (!gpx) return;
      const coord = getFirstCoordinateFromGpx(gpx);
      if (coord) {
        openGoogleMapsTrailhead(coord.lat, coord.lon);
      } else if (showToast) {
        showToast('No GPS coordinates found in GPX file', 'error');
      }
    } catch {
      if (showToast) showToast('Failed to load GPX file', 'error');
    }
  }, [trail, trailId, showToast]);

  return {
    gpxDownloading,
    handleGpxDownload,
    handleTrailhead,
  };
}
