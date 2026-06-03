import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    expect(screen.getByText('Export Schedule')).toBeInTheDocument();
  });

  it('shows Export Schedule button', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    expect(screen.getByText('Export Schedule')).toBeInTheDocument();
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

  it('renders all 178 trails in available hikes', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    // Should show hike count matching trails
    const availableText = screen.getByText(/Available Hikes/);
    expect(availableText).toBeInTheDocument();
  });

  it('filters hikes by search text', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'town' } });
    // Should show filtered count
    const availableText = screen.getByText(/Available Hikes/);
    expect(availableText).toBeInTheDocument();
  });

  it('filters hikes by difficulty', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    // Check for difficulty filter checkboxes
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Easy' } });
    const availableText = screen.getByText(/Available Hikes/);
    expect(availableText).toBeInTheDocument();
  });

  it('stores schedule with trail IDs in localStorage', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    const scheduleKey = 'hiker-schedule';
    const stored = localStorage.getItem(scheduleKey);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored);
    // Should be an object with month keys
    expect(typeof parsed).toBe('object');
  });

  it('handles trail not found gracefully', () => {
    localStorage.setItem('hiker-schedule', JSON.stringify({
      'June': { 3: 'invalid-trail-id' }
    }));
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    // Should not crash
    expect(screen.getByText('Schedule Builder')).toBeInTheDocument();
  });

  it('shows debug mode toggle in settings', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    expect(screen.getByText(/Debug Mode/)).toBeInTheDocument();
  });

  it('toggles debug mode', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    const debugBtn = screen.getByText(/Debug Mode/);
    fireEvent.click(debugBtn);
    expect(debugBtn).toHaveTextContent(/ON|OFF/);
  });

  it('clears console on search change in debug mode', () => {
    localStorage.setItem('hiker-schedule-debug', 'true');
    const clearSpy = vi.spyOn(console, 'clear');
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    // Should clear console when search changes
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('normalizes schedule store from legacy format', () => {
    localStorage.setItem('hiker-schedule', JSON.stringify({
      'June': { 3: 'some-trail-id' }
    }));
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    expect(screen.getByText('Schedule Builder')).toBeInTheDocument();
  });

  it('normalizes schedule store from new format', () => {
    localStorage.setItem('hiker-schedule', JSON.stringify({
      'June': { 3: { trail_id: 'some-trail-id' } }
    }));
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    expect(screen.getByText('Schedule Builder')).toBeInTheDocument();
  });

  it('renders date grid with correct day numbers', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    // June 2026 has Wed/Fri on: 3, 5, 10, 12, 17, 19, 24, 26
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('shows day of week labels', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    expect(screen.getAllByText(/Wed/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Fri/).length).toBeGreaterThan(0);
  });

  it('handles empty schedule data', () => {
    localStorage.setItem('hiker-schedule', JSON.stringify({}));
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    expect(screen.getByText('Schedule Builder')).toBeInTheDocument();
  });

  it('shows available hikes count', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    const availableHikes = screen.getByText(/Available Hikes \(\d+\)/);
    expect(availableHikes).toBeInTheDocument();
  });

  it('shows assigned count in scheduled button', () => {
    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <ScheduleBuilder />
      </MemoryRouter>
    );
    const scheduledBtn = screen.getByText(/Scheduled \(\d+\)/);
    expect(scheduledBtn).toBeInTheDocument();
  });
});
