import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MonthContextProvider } from '../../contexts/MonthContext';
import { ScheduleSettingsProvider } from '../../contexts/ScheduleSettingsContext';
import { TrailActionsProvider } from '../../contexts/TrailActionsContext';
import ScheduleSettingsDropdown from '../../components/ScheduleSettingsDropdown';

describe('ScheduleSettingsDropdown', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  const renderMenu = () => render(
    <MemoryRouter initialEntries={['/schedule']}>
      <MonthContextProvider>
        <ScheduleSettingsProvider>
          <TrailActionsProvider>
            <ScheduleSettingsDropdown />
          </TrailActionsProvider>
        </ScheduleSettingsProvider>
      </MonthContextProvider>
    </MemoryRouter>
  );

  it('renders combined menu tabs', () => {
    renderMenu();
    fireEvent.click(screen.getByTitle('Schedule settings'));
    expect(screen.getByRole('tab', { name: 'Schedule' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'User' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Admin' })).toBeInTheDocument();
  });

  it('shows schedule actions by default', () => {
    renderMenu();
    fireEvent.click(screen.getByTitle('Schedule settings'));
    expect(screen.getByText('Export Monthly HTML')).toBeInTheDocument();
    expect(screen.getByText('Clear All Data')).toBeInTheDocument();
  });

  it('shows user actions in the User tab', () => {
    renderMenu();
    fireEvent.click(screen.getByTitle('Schedule settings'));
    fireEvent.click(screen.getByRole('tab', { name: 'User' }));
    expect(screen.getByText('New Trail')).toBeInTheDocument();
    expect(screen.getByText('Export JSON')).toBeInTheDocument();
    expect(screen.getByText('Export ZIP')).toBeInTheDocument();
    expect(screen.getByText('Export GPX ZIP')).toBeInTheDocument();
    expect(screen.getByText('Export Schedule')).toBeInTheDocument();
    expect(screen.getByText('Export Monthly Pop')).toBeInTheDocument();
    expect(screen.getByText('Validate DB')).toBeInTheDocument();
  });

  it('shows admin actions in the Admin tab', () => {
    renderMenu();
    fireEvent.click(screen.getByTitle('Schedule settings'));
    fireEvent.click(screen.getByRole('tab', { name: 'Admin' }));
    expect(screen.getByText('Import Database (XLS)')).toBeInTheDocument();
    expect(screen.getByText('Import Hike TSV')).toBeInTheDocument();
    expect(screen.getByText('Import All JSON')).toBeInTheDocument();
    expect(screen.getByText('Import ZIP')).toBeInTheDocument();
    expect(screen.getByText('Import Schedule JSON')).toBeInTheDocument();
    expect(screen.getByText('Import Monthly Pop TSV')).toBeInTheDocument();
    expect(screen.getByText('Cleanup Orphaned Details')).toBeInTheDocument();
    expect(screen.getByText('Validate Data')).toBeInTheDocument();
    expect(screen.getByText('Re-sync GPX Coords')).toBeInTheDocument();
    expect(screen.queryByText('Reload Schedule')).not.toBeInTheDocument();
  });
});
