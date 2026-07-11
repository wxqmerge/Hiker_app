import { useState, useCallback } from 'react';
import { getGpx } from '../api/client';
import { downloadBlob, getFirstCoordinateFromGpx, openGoogleMapsTrailhead } from '../utils/io';

export function useGpxActions(trail, showToast) {
  const [gpxDownloading, setGpxDownloading] = useState(false);

  const handleGpxDownload = useCallback(async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!trail || gpxDownloading) return;
    setGpxDownloading(true);
    try {
      const gpx = await getGpx(trail.id);
      if (gpx) {
        const safeName = (trail.fullName || trail.name || 'route').replace(/[^a-zA-Z0-9]/g, '_');
        downloadBlob(gpx, `${safeName}.gpx`, 'application/gpx+xml');
      }
    } finally {
      setTimeout(() => setGpxDownloading(false), 1000);
    }
  }, [trail, gpxDownloading]);

  const handleTrailhead = useCallback(async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!trail) return;
    const gpx = await getGpx(trail.id);
    if (!gpx) return;
    const coord = getFirstCoordinateFromGpx(gpx);
    if (coord) {
      openGoogleMapsTrailhead(coord.lat, coord.lon);
    } else if (showToast) {
      showToast('No GPS coordinates found in GPX file', 'error');
    }
  }, [trail, showToast]);

  return {
    gpxDownloading,
    handleGpxDownload,
    handleTrailhead,
  };
}
