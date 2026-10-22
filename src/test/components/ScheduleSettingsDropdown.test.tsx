import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MonthContextProvider } from '../../contexts/MonthContext';
import { ScheduleSettingsProvider } from '../../contexts/ScheduleSettingsContext';
import { TrailActionsProvider } from '../../contexts/TrailActionsContext';
import ScheduleSettingsDropdown from '../../components/ScheduleSettingsDropdown';
import { API_KEY_STORAGE_KEY } from '../../utils/apiKey';

describe('ScheduleSettingsDropdown', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    const baseFetch = globalThis.fetch;
    globalThis.fetch = vi.fn((url: string, options?: RequestInit) => {
      if (String(url).endsWith('/api/auth/verify')) {
        return Promise.resolve({ status: 204 } as Response);
      }
      return baseFetch(url, options);
    }) as typeof globalThis.fetch;
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
    expect(screen.getByRole('tab', { name: 'About' })).toBeInTheDocument();
  });

  it('shows about info by default', () => {
    renderMenu();
    fireEvent.click(screen.getByTitle('Schedule settings'));
    expect(screen.getByText(/Open source/)).toBeInTheDocument();
    expect(screen.getByText('View on GitHub')).toBeInTheDocument();
  });

  it('shows schedule actions in the Schedule tab', () => {
    renderMenu();
    fireEvent.click(screen.getByTitle('Schedule settings'));
    fireEvent.click(screen.getByRole('tab', { name: 'Schedule' }));
    expect(screen.getByText('Export Monthly HTML')).toBeInTheDocument();
    expect(screen.getByText(/Clear Schedule/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Schedule History/ })).toBeDisabled();
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
    expect(screen.getByRole('button', { name: /New Trail/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Export ZIP/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Validate DB/ })).toBeDisabled();
  });

  it('shows admin actions in the Admin tab', () => {
    renderMenu();
    fireEvent.click(screen.getByTitle('Schedule settings'));
    fireEvent.click(screen.getByRole('tab', { name: 'Admin' }));
    expect(screen.getByText('Import All JSON')).toBeInTheDocument();
    expect(screen.getByText('Import ZIP')).toBeInTheDocument();
    expect(screen.getByText('Import Schedule JSON')).toBeInTheDocument();
    expect(screen.getByText('Import Monthly Pop TSV')).toBeInTheDocument();
    expect(screen.getByText('Cleanup Orphaned Details')).toBeInTheDocument();
    expect(screen.getByText('Validate Data')).toBeInTheDocument();
    expect(screen.getByText('Re-sync GPX Coords')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Check GPX Integrity/ })).toBeDisabled();
    expect(screen.queryByText('Reload Schedule')).not.toBeInTheDocument();
  });

  it('enables key-required actions when an API key is stored', async () => {
    localStorage.setItem(API_KEY_STORAGE_KEY, 'test-key');
    renderMenu();
    fireEvent.click(screen.getByTitle('Schedule settings'));
    fireEvent.click(screen.getByRole('tab', { name: 'Admin' }));
    await waitFor(() => expect(screen.getByText('Verified. Admin actions are enabled.')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Schedule' }));
    expect(screen.getByRole('button', { name: /Schedule History/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('tab', { name: 'User' }));
    expect(screen.getByRole('button', { name: /New Trail/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Export ZIP/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Validate DB/ })).toBeEnabled();
  });

  it('shows about info in the About tab', () => {
    renderMenu();
    fireEvent.click(screen.getByTitle('Schedule settings'));
    fireEvent.click(screen.getByRole('tab', { name: 'About' }));
    expect(screen.getByText(/Open source/)).toBeInTheDocument();
    expect(screen.getByText('View on GitHub')).toBeInTheDocument();
  });

  it('stores and verifies an entered API key', async () => {
    renderMenu();
    fireEvent.click(screen.getByTitle('Schedule settings'));
    fireEvent.click(screen.getByRole('tab', { name: 'Admin' }));

    fireEvent.change(screen.getByLabelText('Admin API key'), { target: { value: 'good-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe('good-key'));
    expect(screen.getByText('Verified. Admin actions are enabled.')).toBeInTheDocument();
  });

  it('does not store an invalid API key', async () => {
    globalThis.fetch = vi.fn((url: string) => {
      if (String(url).endsWith('/api/auth/verify')) {
        return Promise.resolve({ status: 401 } as Response);
      }
      return Promise.resolve({ status: 404, json: () => Promise.resolve({}) } as Response);
    }) as typeof globalThis.fetch;

    renderMenu();
    fireEvent.click(screen.getByTitle('Schedule settings'));
    fireEvent.click(screen.getByRole('tab', { name: 'Admin' }));

    fireEvent.change(screen.getByLabelText('Admin API key'), { target: { value: 'bad-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByText('Invalid API key. Enter a valid key.')).toBeInTheDocument());
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();
    expect(screen.getByRole('button', { name: /Check GPX Integrity/ })).toBeDisabled();
  });
});
