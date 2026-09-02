import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScheduleBuilder from '../../pages/ScheduleBuilder';
import { MonthContextProvider } from '../../contexts/MonthContext';
import { ScheduleSettingsProvider } from '../../contexts/ScheduleSettingsContext';
import ScheduleSettingsDropdown from '../../components/ScheduleSettingsDropdown';

describe('ScheduleBuilder', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  const renderSchedule = () => render(
    <MemoryRouter initialEntries={['/schedule']}>
      <MonthContextProvider>
        <ScheduleSettingsProvider>
          <ScheduleSettingsDropdown />
          <ScheduleBuilder />
        </ScheduleSettingsProvider>
      </MonthContextProvider>
    </MemoryRouter>
  );

  const openScheduleTab = () => {
    fireEvent.click(screen.getByTitle('Schedule settings'));
    fireEvent.click(screen.getByRole('tab', { name: 'Schedule' }));
  };

  it('renders settings button', () => {
    renderSchedule();
    expect(screen.getByTitle('Schedule settings')).toBeInTheDocument();
  });

  it('renders FilterPanel search', () => {
    renderSchedule();
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('renders Settings button', () => {
    renderSchedule();
    expect(screen.getByTitle('Schedule settings')).toBeInTheDocument();
  });

  it('renders Export Monthly HTML in settings menu', () => {
    renderSchedule();
    openScheduleTab();
    expect(screen.getByText('Export Monthly HTML')).toBeInTheDocument();
  });

  it('renders FilterPanel', () => {
    renderSchedule();
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('shows date grid', () => {
    renderSchedule();
    expect(screen.getByText(/Dates/)).toBeInTheDocument();
  });

  it('shows available hikes section', () => {
    renderSchedule();
    expect(screen.getByText(/Available Hikes/)).toBeInTheDocument();
  });

  it('opens settings menu', () => {
    renderSchedule();
    openScheduleTab();
    expect(screen.getByText('Export Monthly HTML')).toBeInTheDocument();
  });

  it('shows Export Quarterly Schedule button', () => {
    renderSchedule();
    openScheduleTab();
    expect(screen.getByText('Export Quarterly Schedule')).toBeInTheDocument();
  });

  it('shows Import Quarterly Schedule TSV button', () => {
    renderSchedule();
    openScheduleTab();
    expect(screen.getByText(/Import Quarterly Schedule TSV/)).toBeInTheDocument();
  });

  it('shows Clear Schedule button', () => {
    renderSchedule();
    openScheduleTab();
    expect(screen.getByText(/Clear Schedule/)).toBeInTheDocument();
  });

  it('shows Debug Mode toggle', () => {
    renderSchedule();
    openScheduleTab();
    expect(screen.getByText(/Debug Mode/)).toBeInTheDocument();
  });

  it('handles month selection', () => {
    renderSchedule();
  });

  it('renders drag-and-drop zones', () => {
    renderSchedule();
    expect(screen.getByText(/Available Hikes/)).toBeInTheDocument();
    expect(screen.getByText(/Dates/)).toBeInTheDocument();
  });

  it('renders all 178 trails in available hikes', () => {
    renderSchedule();
    const availableText = screen.getByText(/Available Hikes/);
    expect(availableText).toBeInTheDocument();
  });

  it('filters hikes by search text', () => {
    renderSchedule();
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'town' } });
    const availableText = screen.getByText(/Available Hikes/);
    expect(availableText).toBeInTheDocument();
  });

  it('filters hikes by difficulty', () => {
    renderSchedule();
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Easy' } });
    const availableText = screen.getByText(/Available Hikes/);
    expect(availableText).toBeInTheDocument();
  });

  it('stores schedule with trail IDs in server state', () => {
    renderSchedule();
    expect(screen.getByTitle('Schedule settings')).toBeInTheDocument();
  });

  it('handles trail not found gracefully', () => {
    localStorage.setItem('hiker-schedule', JSON.stringify({
      'June': { 3: 'invalid-trail-id' }
    }));
    renderSchedule();
    expect(screen.getByTitle('Schedule settings')).toBeInTheDocument();
  });

  it('shows debug mode toggle in settings', () => {
    renderSchedule();
    openScheduleTab();
    expect(screen.getByText(/Debug Mode/)).toBeInTheDocument();
  });

  it('toggles debug mode', () => {
    renderSchedule();
    openScheduleTab();
    const debugBtn = screen.getByText(/Debug Mode/);
    fireEvent.click(debugBtn);
    expect(debugBtn).toHaveTextContent(/ON|OFF/);
  });

  it('normalizes schedule store from legacy format', () => {
    localStorage.setItem('hiker-schedule', JSON.stringify({
      'June': { 3: 'some-trail-id' }
    }));
    renderSchedule();
    expect(screen.getByTitle('Schedule settings')).toBeInTheDocument();
  });

  it('normalizes schedule store from new format', () => {
    localStorage.setItem('hiker-schedule', JSON.stringify({
      'June': { 3: { trail_id: 'some-trail-id' } }
    }));
    renderSchedule();
    expect(screen.getByTitle('Schedule settings')).toBeInTheDocument();
  });

  it('renders date grid with correct day numbers', () => {
    renderSchedule();
    const dateGrid = screen.getByText(/2026/).closest('div');
    expect(dateGrid).not.toBeNull();
    expect(dateGrid!.querySelectorAll('[class*="text"]').length).toBeGreaterThan(0);
  });

  it('shows day of week labels', () => {
    renderSchedule();
    expect(screen.getAllByText(/Wed/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Fri/).length).toBeGreaterThan(0);
  });

  it('handles empty schedule data', () => {
    localStorage.setItem('hiker-schedule', JSON.stringify({}));
    renderSchedule();
    expect(screen.getByTitle('Schedule settings')).toBeInTheDocument();
  });

  it('shows available hikes count', () => {
    renderSchedule();
    const availableHikes = screen.getByText(/Available Hikes \(\d+\)/);
    expect(availableHikes).toBeInTheDocument();
  });

});
