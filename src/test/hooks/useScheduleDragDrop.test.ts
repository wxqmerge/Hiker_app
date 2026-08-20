import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useScheduleDragDrop } from '../../hooks/useScheduleDragDrop';

describe('useScheduleDragDrop', () => {
  const scheduleStore = {
    January: { 1: [{ trail_id: 'trail-1' }] },
  };

  const findTrailById = vi.fn((id) => {
    if (id === 'trail-1') return { id: 'trail-1', name: 'Trail One', fullName: 'Trail One Full' };
    if (id === 'trail-2') return { id: 'trail-2', name: 'Trail Two', fullName: 'Trail Two Full' };
    return null;
  });

  const updateScheduleFn = vi.fn((monthName, updater) => {
    if (typeof updater === 'function') {
      const current = scheduleStore[monthName] || {};
      const updated = updater(current);
      scheduleStore[monthName] = updated;
    }
  });

  const setDragData = vi.fn();
  const setPendingSwap = vi.fn();

  const trailIndexToId = { 0: 'trail-1', 1: 'trail-2' };

  const baseDeps = {
    scheduleStore,
    selectedMonth: 0,
    year: 2024,
    dragData: null,
    setDragData,
    pendingSwap: null,
    setPendingSwap,
    findTrailById,
    trailIndexToId,
    updateScheduleFn,
    hasApiKey: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    scheduleStore.January = { 1: [{ trail_id: 'trail-1' }] };
  });

  it('returns expected functions', () => {
    const result = useScheduleDragDrop(baseDeps);
    expect(result).toHaveProperty('confirmSwap');
    expect(result).toHaveProperty('cancelSwap');
    expect(result).toHaveProperty('handleDropOnDate');
    expect(result).toHaveProperty('handleDropOnAvailable');
    expect(result).toHaveProperty('removeHike');
  });

  it('cancelSwap clears pending swap', () => {
    const deps = { ...baseDeps, pendingSwap: { sourceDay: 1 } };
    const result = useScheduleDragDrop(deps);
    result.cancelSwap();
    expect(setPendingSwap).toHaveBeenCalledWith(null);
  });

  it('handleDropOnDate does nothing without dragData', () => {
    const result = useScheduleDragDrop(baseDeps);
    result.handleDropOnDate(5, 0);
    expect(updateScheduleFn).not.toHaveBeenCalled();
  });

  it('handleDropOnDate does nothing without API key', () => {
    const deps = { ...baseDeps, dragData: { hikeIndex: 0 }, hasApiKey: false };
    const result = useScheduleDragDrop(deps);
    result.handleDropOnDate(5, 0);
    expect(updateScheduleFn).not.toHaveBeenCalled();
  });

  it('handleDropOnDate drops on empty slot', () => {
    const deps = { ...baseDeps, dragData: { hikeIndex: 0, sourceDay: null, sourceSlot: null } };
    const result = useScheduleDragDrop(deps);
    result.handleDropOnDate(5, 0);
    expect(updateScheduleFn).toHaveBeenCalled();
  });

  it('handleDropOnDate offers swap when target has hike', () => {
    scheduleStore.January = { 1: [{ trail_id: 'trail-1' }], 8: [{ trail_id: 'trail-2' }] };
    const deps = { ...baseDeps, dragData: { hikeIndex: 0, sourceDay: 1, sourceSlot: 0 } };
    const result = useScheduleDragDrop(deps);
    result.handleDropOnDate(8, 0);
    expect(setPendingSwap).toHaveBeenCalledTimes(1);
    expect(setPendingSwap.mock.calls[0][0]).toHaveProperty('sourceTrailName');
    expect(setPendingSwap.mock.calls[0][0]).toHaveProperty('targetTrailName');
  });

  it('confirmSwap executes the swap', () => {
    scheduleStore.January = { 1: [{ trail_id: 'trail-1' }], 8: [{ trail_id: 'trail-2' }] };
    const pendingSwap = {
      sourceDay: 1,
      sourceSlot: 0,
      targetDay: 8,
      targetSlot: 0,
      targetEntry: { trail_id: 'trail-2' },
      trailId: 'trail-1',
      earlyStart: false,
      leader: '',
    };
    const deps = { ...baseDeps, pendingSwap };
    const result = useScheduleDragDrop(deps);
    result.confirmSwap();
    expect(updateScheduleFn).toHaveBeenCalled();
    expect(setPendingSwap).toHaveBeenCalledWith(null);
  });

  it('removeHike removes a hike', () => {
    const result = useScheduleDragDrop(baseDeps);
    result.removeHike(1, 0);
    expect(updateScheduleFn).toHaveBeenCalled();
  });

  it('removeHike does nothing without API key', () => {
    const deps = { ...baseDeps, hasApiKey: false };
    const result = useScheduleDragDrop(deps);
    result.removeHike(1, 0);
    expect(updateScheduleFn).not.toHaveBeenCalled();
  });

  it('handleDropOnAvailable removes hike from slot', () => {
    const deps = { ...baseDeps, dragData: { hikeIndex: 0 } };
    const result = useScheduleDragDrop(deps);
    result.handleDropOnAvailable(1, 0);
    expect(updateScheduleFn).toHaveBeenCalled();
  });

  it('handleDropOnAvailable does nothing without dragData', () => {
    const result = useScheduleDragDrop(baseDeps);
    result.handleDropOnAvailable(1, 0);
    expect(updateScheduleFn).not.toHaveBeenCalled();
  });

  it('handleDropOnAvailable does nothing without API key', () => {
    const deps = { ...baseDeps, dragData: { hikeIndex: 0 }, hasApiKey: false };
    const result = useScheduleDragDrop(deps);
    result.handleDropOnAvailable(1, 0);
    expect(updateScheduleFn).not.toHaveBeenCalled();
  });

  it('normalizes object-shaped day entries when dropping on an empty slot', () => {
    scheduleStore.January = { 1: { trail_id: 'trail-1' } };
    const deps = { ...baseDeps, dragData: { hikeIndex: 1, sourceDay: null, sourceSlot: null } };
    const result = useScheduleDragDrop(deps);
    result.handleDropOnDate(8, 0);
    expect(scheduleStore.January['8']).toEqual([{ trail_id: 'trail-2', early_start: false, leader: '' }]);
  });

  it('offers swap when target is object-shaped', () => {
    scheduleStore.January = { 1: { trail_id: 'trail-1' }, 8: { trail_id: 'trail-2' } };
    const deps = { ...baseDeps, dragData: { hikeIndex: 0, sourceDay: 1, sourceSlot: 0 } };
    const result = useScheduleDragDrop(deps);
    result.handleDropOnDate(8, 0);
    expect(setPendingSwap).toHaveBeenCalledTimes(1);
    expect(setPendingSwap.mock.calls[0][0].targetEntry).toEqual({ trail_id: 'trail-2', early_start: false, leader: '' });
  });

  it('confirmSwap normalizes source and target to arrays', () => {
    scheduleStore.January = { 1: { trail_id: 'trail-1' }, 8: { trail_id: 'trail-2' } };
    const pendingSwap = {
      sourceDay: 1,
      sourceSlot: 0,
      targetDay: 8,
      targetSlot: 0,
      targetEntry: { trail_id: 'trail-2', early_start: false, leader: '' },
      trailId: 'trail-1',
      earlyStart: false,
      leader: '',
    };
    const deps = { ...baseDeps, pendingSwap };
    const result = useScheduleDragDrop(deps);
    result.confirmSwap();
    expect(scheduleStore.January['1']).toEqual([{ trail_id: 'trail-2', early_start: false, leader: '' }]);
    expect(scheduleStore.January['8']).toEqual([{ trail_id: 'trail-1', early_start: false, leader: '' }]);
  });

  it('removeHike normalizes object-shaped entries to empty arrays', () => {
    scheduleStore.January = { 1: { trail_id: 'trail-1' } };
    const result = useScheduleDragDrop(baseDeps);
    result.removeHike(1, 0);
    expect(scheduleStore.January['1']).toEqual([{ trail_id: null, early_start: false, leader: '' }]);
  });
});
