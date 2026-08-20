import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MonthlyScoreGrid, { ScoreBreakdownRow } from '../../components/MonthlyScoreGrid';

vi.mock('../../utils/score.js', () => {
  const getSeasonalInfo = (seasonal: any) => ({ hasQuarterData: !!seasonal?.Q1 });
  const calculateMonthlyScore = (hikeCount: number, idx: number, availableMonths: number[], hasQuarterData: boolean) => {
    let score = 0;
    if (hasQuarterData) score += 1;
    if (availableMonths.includes(idx + 1)) score += 1;
    score += Math.min(9, hikeCount * 2);
    return Math.min(10, score);
  };
  const computeMonthlyScores = (monthly: number[], availableMonths: number[], hasQuarterData: boolean) =>
    (Array.isArray(monthly) ? monthly : []).map((hikeCount, idx) =>
      calculateMonthlyScore(hikeCount, idx, availableMonths, hasQuarterData)
    );
  return { getSeasonalInfo, calculateMonthlyScore, computeMonthlyScores };
});

describe('MonthlyScoreGrid', () => {
  const defaultProps = {
    monthly: [2, 1, 0, 3, 2, 1, 0, 0, 0, 1, 2, 0],
    availableMonths: [1, 2, 4, 10, 11],
    seasonal: { Q1: 2 },
    showBreakdown: false,
    titlePrefix: 'Score: ',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no monthly data', () => {
    const { container } = render(<MonthlyScoreGrid monthly={null as any} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when empty monthly array', () => {
    const { container } = render(<MonthlyScoreGrid monthly={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders 12 month badges', () => {
    const { container } = render(<MonthlyScoreGrid {...defaultProps} />);
    const badges = container.querySelectorAll('.w-10');
    expect(badges.length).toBe(12);
  });

  it('renders month abbreviations', () => {
    render(<MonthlyScoreGrid {...defaultProps} />);
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Dec')).toBeInTheDocument();
  });

  it('renders score for months with hikes', () => {
    render(<MonthlyScoreGrid {...defaultProps} />);
    const scores = screen.getAllByText('5');
    expect(scores.length).toBeGreaterThan(0);
  });

  it('shows breakdown in title when showBreakdown', () => {
    const { container } = render(<MonthlyScoreGrid {...defaultProps} showBreakdown />);
    const badges = container.querySelectorAll('[title]');
    const firstTitle = badges[0]?.getAttribute('title');
    expect(firstTitle).toContain('+');
  });

  it('applies green styling for scored months', () => {
    const { container } = render(<MonthlyScoreGrid {...defaultProps} />);
    const badges = container.querySelectorAll('.text-green-800');
    expect(badges.length).toBeGreaterThan(0);
  });
});

describe('ScoreBreakdownRow', () => {
  const defaultProps = {
    monthly: [2, 1, 0, 3, 2, 1, 0, 0, 0, 1, 2, 0],
    availableMonths: [1, 2, 4, 10, 11],
    seasonal: { Q1: 2 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no monthly data', () => {
    const { container } = render(<ScoreBreakdownRow monthly={null as any} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when empty monthly array', () => {
    const { container } = render(<ScoreBreakdownRow monthly={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders 12 breakdown items', () => {
    const { container } = render(<ScoreBreakdownRow {...defaultProps} />);
    const items = container.querySelectorAll('.flex-col');
    expect(items.length).toBeGreaterThanOrEqual(12);
  });

  it('renders breakdown formula', () => {
    render(<ScoreBreakdownRow {...defaultProps} />);
    const breakdowns = screen.getAllByText(/1\+1\+4=6/);
    expect(breakdowns.length).toBeGreaterThan(0);
  });
});
