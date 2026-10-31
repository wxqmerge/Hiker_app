import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Descriptions from '../../pages/Descriptions';
import { resetTrailStore } from '../../hooks/useTrailStore';
import { getMonthKey } from '../../utils/dateUtils';
import { MONTH_NAMES } from '../../utils/constants';

const baseFetch = globalThis.fetch;

// Month key offset by n months from today (e.g. -1 = last month).
function monthKey(offset: number) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return getMonthKey(first.getFullYear(), first.getMonth());
}

describe('Descriptions page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const today = new Date();
    const schedule = {
      // today's month: a hike on today's date must appear
      [monthKey(0)]: [{ day: today.getDate(), trail_id: 'trail-1', leader: 'Al' }],
      // next month: day 1 always in the future
      [monthKey(1)]: [{ day: 1, trail_id: 'trail-3' }],
      // last month: must never appear even though it has a hike
      [monthKey(-1)]: [{ day: 2, trail_id: 'trail-2' }],
    };
    globalThis.fetch = vi.fn(async (url: string, opts?: unknown) => {
      if (String(url).includes('/api/schedule')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => schedule,
        };
      }
      return (baseFetch as ReturnType<typeof vi.fn>)(url, opts);
    }) as ReturnType<typeof vi.fn>;
    resetTrailStore();
  });

  it('lists this month and next, but never past months', async () => {
    render(
      <MemoryRouter>
        <Descriptions />
      </MemoryRouter>
    );
    expect(await screen.findByText('Mount Rainier')).toBeInTheDocument();
    expect(screen.getByText('Easy Path Trail')).toBeInTheDocument();
    expect(screen.queryByText('Stevens Ridge')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Printable version' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Printable schedule' })).toBeInTheDocument();
  });

  it('renders both month headings', async () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    render(
      <MemoryRouter>
        <Descriptions />
      </MemoryRouter>
    );
    await screen.findByText('Mount Rainier');
    expect(screen.getByText(`${MONTH_NAMES[now.getMonth()]}, ${now.getFullYear()}`)).toBeInTheDocument();
    expect(screen.getByText(`${MONTH_NAMES[next.getMonth()]}, ${next.getFullYear()}`)).toBeInTheDocument();
  });
});
