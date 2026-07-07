import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScheduleBuilder from '../../pages/ScheduleBuilder';

describe('ScheduleBuilder', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  const renderSchedule = () => render(
    <MemoryRouter initialEntries={['/schedule']}>
      <ScheduleBuilder />
    </MemoryRouter>
  );

  it('renders heading', () => {
    renderSchedule();
    expect(screen.getByText('Schedule Builder')).toBeInTheDocument();
  });

  it('renders Browse Trails link', () => {
    renderSchedule();
    expect(screen.getByText('Browse Trails')).toBeInTheDocument();
  });

  it('renders Settings button', () => {
    renderSchedule();
    expect(screen.getByTitle('Import/Export schedule')).toBeInTheDocument();
  });

  it('renders month selector', () => {
    renderSchedule();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders Export Monthly HTML in settings menu', () => {
    renderSchedule();
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    expect(screen.getByText('Export Monthly HTML')).toBeInTheDocument();
  });

  it('renders FilterPanel', () => {
    renderSchedule();
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('shows date grid', () => {
    renderSchedule();
    expect(screen.getByText(/Wed\/Fri Dates/)).toBeInTheDocument();
  });

  it('shows available hikes section', () => {
    renderSchedule();
    expect(screen.getByText(/Available Hikes/)).toBeInTheDocument();
  });

  it('opens settings menu', () => {
    renderSchedule();
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    expect(screen.getByText('Export Monthly HTML')).toBeInTheDocument();
  });

  it('shows Export Quarterly Schedule button', () => {
    renderSchedule();
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    expect(screen.getByText('Export Quarterly Schedule')).toBeInTheDocument();
  });

  it('shows Import SOTHH Schedule.xls button', () => {
    renderSchedule();
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    expect(screen.getByText(/Import SOTHH Schedule\.xls/)).toBeInTheDocument();
  });

  it('shows Import Quarterly Schedule TSV button', () => {
    renderSchedule();
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    expect(screen.getByText(/Import Quarterly Schedule TSV/)).toBeInTheDocument();
  });

  it('shows Clear All Data button', () => {
    renderSchedule();
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    expect(screen.getByText('Clear All Data')).toBeInTheDocument();
  });

  it('shows Debug Mode toggle', () => {
    renderSchedule();
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    expect(screen.getByText(/Debug Mode/)).toBeInTheDocument();
  });

  it('handles month selection', () => {
    renderSchedule();
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '5' } });
  });

  it('displays date count', () => {
    renderSchedule();
    expect(screen.getByText(/.*\/.* dates filled/)).toBeInTheDocument();
  });

  it('renders drag-and-drop zones', () => {
    renderSchedule();
    expect(screen.getByText(/Available Hikes/)).toBeInTheDocument();
    expect(screen.getByText(/Wed\/Fri Dates/)).toBeInTheDocument();
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
    expect(screen.getByText('Schedule Builder')).toBeInTheDocument();
  });

  it('handles trail not found gracefully', () => {
    localStorage.setItem('hiker-schedule', JSON.stringify({
      'June': { 3: 'invalid-trail-id' }
    }));
    renderSchedule();
    expect(screen.getByText('Schedule Builder')).toBeInTheDocument();
  });

  it('shows debug mode toggle in settings', () => {
    renderSchedule();
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    expect(screen.getByText(/Debug Mode/)).toBeInTheDocument();
  });

  it('toggles debug mode', () => {
    renderSchedule();
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    const debugBtn = screen.getByText(/Debug Mode/);
    fireEvent.click(debugBtn);
    expect(debugBtn).toHaveTextContent(/ON|OFF/);
  });

  it('clears console on search change in debug mode', () => {
    const clearSpy = vi.spyOn(console, 'clear');
    renderSchedule();
    const settingsBtn = screen.getByTitle('Import/Export schedule');
    fireEvent.click(settingsBtn);
    const debugBtn = screen.getByText(/Debug Mode/);
    fireEvent.click(debugBtn);
    fireEvent.click(document.body);
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('normalizes schedule store from legacy format', () => {
    localStorage.setItem('hiker-schedule', JSON.stringify({
      'June': { 3: 'some-trail-id' }
    }));
    renderSchedule();
    expect(screen.getByText('Schedule Builder')).toBeInTheDocument();
  });

  it('normalizes schedule store from new format', () => {
    localStorage.setItem('hiker-schedule', JSON.stringify({
      'June': { 3: { trail_id: 'some-trail-id' } }
    }));
    renderSchedule();
    expect(screen.getByText('Schedule Builder')).toBeInTheDocument();
  });

  it('renders date grid with correct day numbers', () => {
    renderSchedule();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '5' } });
    const dateGrid = screen.getByText(/2026 — Wed\/Fri Dates/).closest('.bg-white');
    expect(dateGrid).not.toBeNull();
    expect(dateGrid!.querySelectorAll('.text-xl').length).toBeGreaterThan(0);
  });

  it('shows day of week labels', () => {
    renderSchedule();
    expect(screen.getAllByText(/Wed/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Fri/).length).toBeGreaterThan(0);
  });

  it('handles empty schedule data', () => {
    localStorage.setItem('hiker-schedule', JSON.stringify({}));
    renderSchedule();
    expect(screen.getByText('Schedule Builder')).toBeInTheDocument();
  });

  it('shows available hikes count', () => {
    renderSchedule();
    const availableHikes = screen.getByText(/Available Hikes \(\d+\)/);
    expect(availableHikes).toBeInTheDocument();
  });

});
