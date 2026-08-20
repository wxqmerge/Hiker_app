import { useState, useCallback } from 'react';
import { getGpx } from '../api/client';
import { downloadBlob, openGoogleMapsTrailhead, sanitizeFilename, shareGpxFile } from '../utils/io';
import { getTrailName } from '../utils/data';

export function useGpxActions(trail) {
  const [gpxDownloading, setGpxDownloading] = useState(false);

  const handleGpxDownload = useCallback(async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const id = trail?.id;
    if (!id || gpxDownloading) return;
    setGpxDownloading(true);
    try {
      const gpx = await getGpx(id);
      if (gpx) {
        const safeName = sanitizeFilename(getTrailName(trail) || 'route');
        downloadBlob(gpx, `${safeName}.gpx`, 'application/gpx+xml');
      }
    } finally {
      setTimeout(() => setGpxDownloading(false), 1000);
    }
  }, [trail, gpxDownloading]);

  const handleTrailhead = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (trail?.trailHeadLat != null && trail?.trailHeadLon != null) {
      openGoogleMapsTrailhead(trail.trailHeadLat, trail.trailHeadLon);
    }
  }, [trail]);

  const handleGpxShare = useCallback(async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const id = trail?.id;
    if (!id) return;
    const gpx = await getGpx(id);
    if (gpx) {
      shareGpxFile(gpx, getTrailName(trail) || 'route');
    }
  }, [trail]);

  return {
    gpxDownloading,
    handleGpxDownload,
    handleTrailhead,
    handleGpxShare,
  };
}
