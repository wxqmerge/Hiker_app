import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrailStore, setSchedule, resetTrailStore } from '../../hooks/useTrailStore';

vi.mock('../../api/client.js', () => ({
  getTrails: vi.fn(() => Promise.resolve([{ id: 'trail-1', name: 'Test Trail' }])),
  getTrailDetails: vi.fn(() => Promise.resolve({ 'trail-1': { fullDescription: 'Details' } })),
  getLookup: vi.fn(() => Promise.resolve({ difficulties: [] })),
  getSchedule: vi.fn(() => Promise.resolve({ Jan: {} })),
  updateTrail: vi.fn((trail) => Promise.resolve(trail)),
  updateTrailDetail: vi.fn((id, detail) => Promise.resolve(detail)),
  deleteTrail: vi.fn((id) => Promise.resolve()),
}));

describe('useTrailStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTrailStore();
  });

  it('returns expected properties', async () => {
    const { result } = renderHook(() => useTrailStore());
    await act(async () => {});
    expect(result.current).toHaveProperty('trails');
    expect(result.current).toHaveProperty('trailDetails');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('lookup');
    expect(result.current).toHaveProperty('schedule');
    expect(result.current).toHaveProperty('saveTrail');
    expect(result.current).toHaveProperty('saveTrailDetail');
    expect(result.current).toHaveProperty('deleteTrail');
    expect(result.current).toHaveProperty('exportJSON');
    expect(result.current).toHaveProperty('importJSON');
    expect(result.current).toHaveProperty('setSchedule');
  });

  it('loads trails from API', async () => {
    const { result } = renderHook(() => useTrailStore());
    await act(async () => {});
    expect(result.current.trails.length).toBeGreaterThan(0);
  });

  it('loads trailDetails from API', async () => {
    const { result } = renderHook(() => useTrailStore());
    await act(async () => {});
    expect(result.current.trailDetails).toHaveProperty('trail-1');
  });

  it('sets schedule', async () => {
    const { result } = renderHook(() => useTrailStore());
    await act(async () => {});
    act(() => {
      result.current.setSchedule({ Jan: { 1: [{ trail_id: 'trail-1' }] } });
    });
    expect(result.current.schedule).toEqual({ Jan: { 1: [{ trail_id: 'trail-1' }] } });
  });

  it('exports JSON', async () => {
    const { result } = renderHook(() => useTrailStore());
    await act(async () => {});
    const exported = await result.current.exportJSON();
    expect(exported).toHaveProperty('trails');
    expect(exported).toHaveProperty('trailDetails');
  });

  it('resets trail store', () => {
    setSchedule({ Jan: { 1: [{ trail_id: 'trail-1' }] } });
    resetTrailStore();
    const { result } = renderHook(() => useTrailStore());
    expect(result.current.schedule).toBeNull();
  });
});
