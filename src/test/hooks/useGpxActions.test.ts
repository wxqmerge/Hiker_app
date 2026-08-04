import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGpxActions } from '../../hooks/useGpxActions';

vi.mock('../../api/client', () => ({
  getGpx: vi.fn(() => Promise.resolve('<gpx><trk><trkseg><trkpt lat="40.0" lon="-74.0"/></trkseg></trk></gpx>')),
}));

vi.mock('../../utils/io', () => ({
  downloadBlob: vi.fn(),
  getFirstCoordinateFromGpx: vi.fn(() => ({ lat: 40.0, lon: -74.0 })),
  openGoogleMapsTrailhead: vi.fn(),
}));

import { getGpx } from '../../api/client';
import { downloadBlob, getFirstCoordinateFromGpx, openGoogleMapsTrailhead } from '../../utils/io';

describe('useGpxActions', () => {
  const trail = {
    id: 'trail-1',
    name: 'Test Trail',
    fullName: 'Test Trail Full',
  };

  const showToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns expected properties', () => {
    const { result } = renderHook(() => useGpxActions(trail, showToast));
    expect(result.current).toHaveProperty('gpxDownloading');
    expect(result.current).toHaveProperty('handleGpxDownload');
    expect(result.current).toHaveProperty('handleTrailhead');
  });

  it('initializes gpxDownloading as false', () => {
    const { result } = renderHook(() => useGpxActions(trail, showToast));
    expect(result.current.gpxDownloading).toBe(false);
  });

  it('downloads GPX when handleGpxDownload called', async () => {
    const { result } = renderHook(() => useGpxActions(trail, showToast));
    await act(async () => {
      await result.current.handleGpxDownload();
    });
    expect(getGpx).toHaveBeenCalledWith('trail-1');
    expect(downloadBlob).toHaveBeenCalled();
  });

  it('downloads GPX with event', async () => {
    const { result } = renderHook(() => useGpxActions(trail, showToast));
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    await act(async () => {
      await result.current.handleGpxDownload(event);
    });
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('sets gpxDownloading to true during download', async () => {
    const { result } = renderHook(() => useGpxActions(trail, showToast));
    await act(async () => {
      result.current.handleGpxDownload();
    });
    expect(result.current.gpxDownloading).toBe(true);
  });

  it('opens trailhead when handleTrailhead called', async () => {
    const { result } = renderHook(() => useGpxActions(trail, showToast));
    await act(async () => {
      await result.current.handleTrailhead();
    });
    expect(getGpx).toHaveBeenCalledWith('trail-1');
    expect(openGoogleMapsTrailhead).toHaveBeenCalledWith(40.0, -74.0);
  });

  it('opens trailhead with event', async () => {
    const { result } = renderHook(() => useGpxActions(trail, showToast));
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    await act(async () => {
      await result.current.handleTrailhead(event);
    });
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('shows toast when no GPS coordinates', async () => {
    vi.mocked(getFirstCoordinateFromGpx).mockReturnValueOnce(null);
    const { result } = renderHook(() => useGpxActions(trail, showToast));
    await act(async () => {
      await result.current.handleTrailhead();
    });
    expect(showToast).toHaveBeenCalledWith('No GPS coordinates found in GPX file', 'error');
  });

  it('handles missing GPX gracefully', async () => {
    vi.mocked(getGpx).mockResolvedValueOnce(null);
    const { result } = renderHook(() => useGpxActions(trail, showToast));
    await act(async () => {
      await result.current.handleGpxDownload();
    });
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('accepts trailId and trailName separately', async () => {
    const { result } = renderHook(() => useGpxActions({ id: 'trail-1', name: 'Trail Name' }, showToast));
    await act(async () => {
      await result.current.handleGpxDownload();
    });
    expect(getGpx).toHaveBeenCalledWith('trail-1');
  });

  it('does not download when already downloading', async () => {
    const { result } = renderHook(() => useGpxActions(trail, showToast));
    await act(async () => {
      result.current.handleGpxDownload();
    });
    const callsBefore = getGpx.mock.calls.length;
    await act(async () => {
      await result.current.handleGpxDownload();
    });
    expect(getGpx.mock.calls.length).toBe(callsBefore);
  });


});
