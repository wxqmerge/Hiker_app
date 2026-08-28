import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MoveHikeModal from '../../components/MoveHikeModal';

describe('MoveHikeModal', () => {
  const findTrailById = vi.fn((id) => {
    if (id === 'trail-1') return { id: 'trail-1', name: 'Trail One', fullName: 'Trail One Full' };
    if (id === 'trail-2') return { id: 'trail-2', name: 'Trail Two', fullName: 'Trail Two Full' };
    return null;
  });

  const source = {
    hikeIndex: null,
    sourceDay: 1,
    sourceSlot: 0,
    trailId: 'trail-1',
    earlyStart: false,
    leader: '',
  };

  const props = {
    open: true,
    source,
    hikeDates: [
      { day: 1, slot: 0 },
      { day: 8, slot: 0 },
    ],
    assignedHikes: {
      1: [{ trail_id: 'trail-1', early_start: false, leader: '' }],
      8: [{ trail_id: 'trail-2', early_start: false, leader: '' }],
    },
    findTrailById,
    year: 2024,
    selectedMonth: 0,
    onMove: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders target options excluding the source slot', () => {
    render(<MoveHikeModal {...props} />);
    expect(screen.getByText('Move Trail One Full')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Monday 8/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Monday 1/ })).not.toBeInTheDocument();
  });

  it('calls onMove with the selected target', () => {
    render(<MoveHikeModal {...props} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '8:0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    expect(props.onMove).toHaveBeenCalledWith(source, 8, 0);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('shows slot letters B/C for a day with 3 slots', () => {
    // Jan 1 and Jan 8, 2024 are both Mondays. Day 1 has 3 slots (A/B/C); source is day 1 slot 0 (A), so it is excluded.
    const threeSlotProps = {
      ...props,
      hikeDates: [
        { day: 1, slot: 0 },
        { day: 1, slot: 1 },
        { day: 1, slot: 2 },
        { day: 8, slot: 0 },
      ],
      assignedHikes: {
        1: [
          { trail_id: 'trail-1', early_start: false, leader: '' },
          { trail_id: 'trail-2', early_start: false, leader: '' },
          { trail_id: 'trail-1', early_start: false, leader: '' },
        ],
        8: [{ trail_id: 'trail-2', early_start: false, leader: '' }],
      },
    };
    render(<MoveHikeModal {...threeSlotProps} />);
    expect(screen.getByRole('option', { name: /Monday 1 B/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Monday 1 C/ })).toBeInTheDocument();
    // Day 8 has a single slot, so no letter suffix.
    expect(screen.getByRole('option', { name: /Monday 8/ })).toBeInTheDocument();
  });
});
