import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScheduleBuilder from '../../pages/ScheduleBuilder';

describe('ScheduleBuilder', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it('renders heading', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    expect(screen.getByText('Schedule Builder')).toBeInTheDocument();
  });

  it('renders Browse Trails link', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    expect(screen.getByText('Browse Trails')).toBeInTheDocument();
  });

  it('renders Scheduled toggle button', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    expect(screen.getByText(/Scheduled/)).toBeInTheDocument();
  });

  it('renders Settings button', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    expect(screen.getByTitle('Import/Export schedule')).toBeInTheDocument();
  });

  it('renders month selector', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders Export to Text File button', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    expect(screen.getByText('Export to Text File')).toBeInTheDocument();
  });

  it('renders FilterPanel', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('shows date grid', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    expect(screen.getByText(/Wed\/Fri Dates/)).toBeInTheDocument();
  });

  it('shows available hikes section', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    expect(screen.getByText(/Available Hikes/)).toBeInTheDocument();
  });

  it('toggles scheduled section', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    const toggle = screen.getByText(/Scheduled/);
    fireEvent.click(toggle);
  });

  it('opens settings menu', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    expect(screen.getByText('Export All')).toBeInTheDocument();
  });

  it('shows Export All button', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    expect(screen.getByText('Export All')).toBeInTheDocument();
  });

  it('shows Import button', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    expect(screen.getByText('Import')).toBeInTheDocument();
  });

  it('shows Clear All Data button', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    expect(screen.getByText('Clear All Data')).toBeInTheDocument();
  });

  it('shows Export Hike Edits button', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    expect(screen.getByText('Export Hike Edits')).toBeInTheDocument();
  });

  it('shows Import Hike Edits button', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    expect(screen.getByText('Import Hike Edits')).toBeInTheDocument();
  });

  it('handles month selection', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '5' } });
  });

  it('displays date count', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    expect(screen.getByText(/.*\/.* dates filled/)).toBeInTheDocument();
  });

  it('renders drag-and-drop zones', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    // Available hikes zone
    expect(screen.getByText(/Available Hikes/)).toBeInTheDocument();
    // Date grid zone
    expect(screen.getByText(/Wed\/Fri Dates/)).toBeInTheDocument();
  });
});
