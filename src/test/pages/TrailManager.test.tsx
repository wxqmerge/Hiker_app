import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrailManager from '../../pages/TrailManager';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual),
    useNavigate: vi.fn(() => vi.fn()),
  };
});

vi.mock('../../hooks/useTrailStore', () => ({
  useTrailStore: vi.fn(() => ({
    trails: [{ id: 'trail-1', name: 'Test Trail', fullName: 'Test Trail Full', distance: 5, hasGpx: true, seasonal: {} }],
    trailDetails: { 'trail-1': { fullDescription: 'Details' } },
    loading: false,
    lookup: null,
    schedule: null,
    saveTrail: vi.fn(),
    deleteTrail: vi.fn(),
    saveTrailDetail: vi.fn(),
    exportJSON: vi.fn(() => Promise.resolve({})),
    importJSON: vi.fn(),
    setSchedule: vi.fn(),
  })),
}));

vi.mock('../../hooks/useTooltips', () => ({
  useTooltips: vi.fn(() => ({ title: (s) => s })),
}));

vi.mock('../../components/PageNav', () => ({
  default: function MockPageNav() {
    return <nav>PageNav</nav>;
  },
}));

vi.mock('../../components/LoadingSpinner', () => ({
  default: function MockLoadingSpinner() {
    return <div>Loading...</div>;
  },
}));

vi.mock('../../utils/io', () => ({
  createFileInput: vi.fn(),
  createImportFileInput: vi.fn(),
  downloadBlob: vi.fn(),
  exportTrailTsv: vi.fn(() => 'tsv content'),
  parseTrailTsv: vi.fn(),
  sanitizeFilename: vi.fn((name) => name),
}));

vi.mock('../../utils/score.js', () => ({
  getSeasonalInfo: vi.fn(() => ({ hasQuarterData: false })),
  calculateMonthlyScore: vi.fn(() => 0),
}));

vi.mock('../../api/client', () => ({
  getGpx: vi.fn(() => Promise.resolve(null)),
  importTrailsFromXls: vi.fn(),
  getSchedule: vi.fn(() => Promise.resolve({})),
  updateSchedule: vi.fn(),
  request: vi.fn(),
  exportDataZip: vi.fn(),
  importDataZip: vi.fn(),
}));

vi.mock('jszip', () => ({
  default: vi.fn().mockImplementation(() => ({
    file: vi.fn(),
    generateAsync: vi.fn(() => Promise.resolve(new Blob())),
  })),
}));

describe('TrailManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders trail manager heading', () => {
    render(
      <MemoryRouter>
        <TrailManager />
      </MemoryRouter>
    );
    expect(screen.getByText('Trail Manager')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(
      <MemoryRouter>
        <TrailManager />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText('Search trails...')).toBeInTheDocument();
  });

  it('renders GPX filter buttons', () => {
    render(
      <MemoryRouter>
        <TrailManager />
      </MemoryRouter>
    );
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('GPX')).toBeInTheDocument();
    expect(screen.getByText('No GPX')).toBeInTheDocument();
  });

  it('renders API key input', () => {
    render(
      <MemoryRouter>
        <TrailManager />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText('API Key')).toBeInTheDocument();
  });

  it('renders Save Key button', () => {
    render(
      <MemoryRouter>
        <TrailManager />
      </MemoryRouter>
    );
    expect(screen.getByText('Save Key')).toBeInTheDocument();
  });

  it('renders trail count', () => {
    render(
      <MemoryRouter>
        <TrailManager />
      </MemoryRouter>
    );
    expect(screen.getByText(/1 of 1 trails/)).toBeInTheDocument();
  });

  it('renders New Trail button', () => {
    render(
      <MemoryRouter>
        <TrailManager />
      </MemoryRouter>
    );
    expect(screen.getByText('New Trail')).toBeInTheDocument();
  });

  it('renders export buttons', () => {
    render(
      <MemoryRouter>
        <TrailManager />
      </MemoryRouter>
    );
    expect(screen.getByText('Export JSON')).toBeInTheDocument();
    expect(screen.getByText('Export ZIP')).toBeInTheDocument();
    expect(screen.getByText('Export GPX ZIP')).toBeInTheDocument();
    expect(screen.getByText('Export Schedule')).toBeInTheDocument();
  });

  it('renders Admin menu button', () => {
    render(
      <MemoryRouter>
        <TrailManager />
      </MemoryRouter>
    );
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('renders Back button', () => {
    render(
      <MemoryRouter>
        <TrailManager />
      </MemoryRouter>
    );
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('renders trail name in table', () => {
    render(
      <MemoryRouter>
        <TrailManager />
      </MemoryRouter>
    );
    expect(screen.getByText('Test Trail Full')).toBeInTheDocument();
  });

  it('renders distance in table', () => {
    render(
      <MemoryRouter>
        <TrailManager />
      </MemoryRouter>
    );
    expect(screen.getByText('5 mi')).toBeInTheDocument();
  });

  it('renders schedule count in table', () => {
    render(
      <MemoryRouter>
        <TrailManager />
      </MemoryRouter>
    );
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
