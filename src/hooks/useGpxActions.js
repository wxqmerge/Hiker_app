import { useState, useCallback } from 'react';
import { getGpx } from '../api/client';
import { downloadBlob, openGoogleMapsTrailhead, sanitizeFilename, shareGpxFile } from '../utils/io';
import { getTrailName } from '../utils/data';

export function useGpxActions(trail) {
  const [downloadingIds, setDownloadingIds] = useState(() => new Set());

  const isDownloading = useCallback(
    (trailId) => downloadingIds.has(trailId),
    [downloadingIds]
  );

  const downloadGpx = useCallback(async (trailId, trailName) => {
    if (!trailId || downloadingIds.has(trailId)) return;
    setDownloadingIds(prev => {
      const next = new Set(prev);
      next.add(trailId);
      return next;
    });
    try {
      const gpx = await getGpx(trailId);
      if (gpx) {
        const safeName = sanitizeFilename(trailName || 'route');
        downloadBlob(gpx, `${safeName}.gpx`, 'application/gpx+xml');
      }
    } finally {
      setTimeout(() => {
        setDownloadingIds(prev => {
          const next = new Set(prev);
          next.delete(trailId);
          return next;
        });
      }, 1000);
    }
  }, [downloadingIds]);

  const openTrailhead = useCallback((trailObj) => {
    if (trailObj?.trailHeadLat != null && trailObj?.trailHeadLon != null) {
      openGoogleMapsTrailhead(trailObj.trailHeadLat, trailObj.trailHeadLon);
    }
  }, []);

  const shareGpx = useCallback(async (trailId, trailName) => {
    if (!trailId) return;
    const gpx = await getGpx(trailId);
    if (gpx) {
      shareGpxFile(gpx, trailName || 'route');
    }
  }, []);

  if (trail) {
    const gpxDownloading = trail.id ? downloadingIds.has(trail.id) : false;
    return {
      gpxDownloading,
      handleGpxDownload: async (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        await downloadGpx(trail.id, getTrailName(trail));
      },
      handleTrailhead: (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        openTrailhead(trail);
      },
      handleGpxShare: async (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        await shareGpx(trail.id, getTrailName(trail));
      },
    };
  }

  return {
    isDownloading,
    downloadGpx,
    openTrailhead,
    shareGpx,
  };
}
