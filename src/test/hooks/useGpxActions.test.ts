import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGpxActions } from '../../hooks/useGpxActions';

vi.mock('../../api/client', () => ({
  getGpx: vi.fn(() => Promise.resolve('<gpx><trk><trkseg><trkpt lat="40.0" lon="-74.0"/></trkseg></trk></gpx>')),
}));

vi.mock('../../utils/io', () => ({
  downloadBlob: vi.fn(),
  openGoogleMapsTrailhead: vi.fn(),
  sanitizeFilename: vi.fn(s => String(s).replace(/[^a-zA-Z0-9_-]/g, '_')),
  shareGpxFile: vi.fn(),
  hasValidCoords: vi.fn((lat, lon) => lat != null && lon != null && !(lat === 0 && lon === 0)),
}));

import { getGpx } from '../../api/client';
import { downloadBlob, openGoogleMapsTrailhead, shareGpxFile } from '../../utils/io';

describe('useGpxActions', () => {
  const trail = {
    id: 'trail-1',
    name: 'Test Trail',
    fullName: 'Test Trail Full',
    trailHeadLat: 40.0,
    trailHeadLon: -74.0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns expected properties', () => {
    const { result } = renderHook(() => useGpxActions(trail));
    expect(result.current).toHaveProperty('gpxDownloading');
    expect(result.current).toHaveProperty('handleGpxDownload');
    expect(result.current).toHaveProperty('handleTrailhead');
  });

  it('initializes gpxDownloading as false', () => {
    const { result } = renderHook(() => useGpxActions(trail));
    expect(result.current.gpxDownloading).toBe(false);
  });

  it('downloads GPX when handleGpxDownload called', async () => {
    const { result } = renderHook(() => useGpxActions(trail));
    await act(async () => {
      await result.current.handleGpxDownload();
    });
    expect(getGpx).toHaveBeenCalledWith('trail-1');
    expect(downloadBlob).toHaveBeenCalled();
  });

  it('downloads GPX with event', async () => {
    const { result } = renderHook(() => useGpxActions(trail));
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    await act(async () => {
      await result.current.handleGpxDownload(event);
    });
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('sets gpxDownloading to true during download', async () => {
    const { result } = renderHook(() => useGpxActions(trail));
    await act(async () => {
      result.current.handleGpxDownload();
    });
    expect(result.current.gpxDownloading).toBe(true);
  });

  it('opens trailhead when handleTrailhead called', () => {
    const { result } = renderHook(() => useGpxActions(trail));
    act(() => {
      result.current.handleTrailhead();
    });
    expect(openGoogleMapsTrailhead).toHaveBeenCalledWith(40.0, -74.0);
  });

  it('opens trailhead with event', () => {
    const { result } = renderHook(() => useGpxActions(trail));
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    act(() => {
      result.current.handleTrailhead(event);
    });
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('does not open trailhead when no coordinates', () => {
    const noCoordTrail = { id: 'trail-1', name: 'Test Trail' };
    const { result } = renderHook(() => useGpxActions(noCoordTrail));
    act(() => {
      result.current.handleTrailhead();
    });
    expect(openGoogleMapsTrailhead).not.toHaveBeenCalled();
  });

  it('handles missing GPX gracefully', async () => {
    vi.mocked(getGpx).mockResolvedValueOnce(null);
    const { result } = renderHook(() => useGpxActions(trail));
    await act(async () => {
      await result.current.handleGpxDownload();
    });
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('accepts trailId and trailName separately', async () => {
    const { result } = renderHook(() => useGpxActions({ id: 'trail-1', name: 'Trail Name' }));
    await act(async () => {
      await result.current.handleGpxDownload();
    });
    expect(getGpx).toHaveBeenCalledWith('trail-1');
  });

  it('does not download when already downloading', async () => {
    const { result } = renderHook(() => useGpxActions(trail));
    await act(async () => {
      result.current.handleGpxDownload();
    });
    const callsBefore = getGpx.mock.calls.length;
    await act(async () => {
      await result.current.handleGpxDownload();
    });
    expect(getGpx.mock.calls.length).toBe(callsBefore);
  });

  it('shares GPX when handleGpxShare called', async () => {
    const { result } = renderHook(() => useGpxActions(trail));
    await act(async () => {
      await result.current.handleGpxShare();
    });
    expect(getGpx).toHaveBeenCalledWith('trail-1');
    expect(shareGpxFile).toHaveBeenCalledWith('<gpx><trk><trkseg><trkpt lat="40.0" lon="-74.0"/></trkseg></trk></gpx>', 'Test Trail Full');
  });

  it('does not share GPX when missing', async () => {
    vi.mocked(getGpx).mockResolvedValueOnce(null);
    const { result } = renderHook(() => useGpxActions(trail));
    await act(async () => {
      await result.current.handleGpxShare();
    });
    expect(shareGpxFile).not.toHaveBeenCalled();
  });

  describe('trail-agnostic mode', () => {
    it('returns per-trail action helpers', () => {
      const { result } = renderHook(() => useGpxActions());
      expect(result.current).toHaveProperty('isDownloading');
      expect(result.current).toHaveProperty('downloadGpx');
      expect(result.current).toHaveProperty('openTrailhead');
      expect(result.current).toHaveProperty('shareGpx');
    });

    it('tracks downloading state by trail ID', async () => {
      const { result } = renderHook(() => useGpxActions());
      expect(result.current.isDownloading('trail-1')).toBe(false);
      await act(async () => {
        result.current.downloadGpx('trail-1', 'Test Trail');
      });
      expect(result.current.isDownloading('trail-1')).toBe(true);
      expect(getGpx).toHaveBeenCalledWith('trail-1');
      expect(downloadBlob).toHaveBeenCalled();
    });

    it('does not start a duplicate download for the same trail', async () => {
      const { result } = renderHook(() => useGpxActions());
      await act(async () => {
        result.current.downloadGpx('trail-1', 'Test Trail');
      });
      const callsBefore = getGpx.mock.calls.length;
      await act(async () => {
        result.current.downloadGpx('trail-1', 'Test Trail');
      });
      expect(getGpx.mock.calls.length).toBe(callsBefore);
    });

    it('opens trailhead from a trail object', () => {
      const { result } = renderHook(() => useGpxActions());
      act(() => {
        result.current.openTrailhead(trail);
      });
      expect(openGoogleMapsTrailhead).toHaveBeenCalledWith(40.0, -74.0);
    });

    it('shares GPX by trail ID and name', async () => {
      const { result } = renderHook(() => useGpxActions());
      await act(async () => {
        await result.current.shareGpx('trail-1', 'Test Trail Full');
      });
      expect(getGpx).toHaveBeenCalledWith('trail-1');
      expect(shareGpxFile).toHaveBeenCalledWith('<gpx><trk><trkseg><trkpt lat="40.0" lon="-74.0"/></trkseg></trk></gpx>', 'Test Trail Full');
    });
  });
});
