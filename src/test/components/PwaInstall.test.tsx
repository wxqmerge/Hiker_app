import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PwaInstall from '../../components/PwaInstall';
import { getDevicePlatform } from '../../utils/device';

vi.mock('../../utils/device', () => ({
  getDevicePlatform: vi.fn(() => 'windows'),
}));

const setupMatchMedia = (matches = false) => {
  const mock = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  Object.defineProperty(window, 'matchMedia', { value: mock, writable: true });
  return mock;
};

const fireBeforeInstallPrompt = () => {
  const event = new Event('beforeinstallprompt');
  event.prompt = vi.fn();
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  act(() => { window.dispatchEvent(event); });
  return event;
};

describe('PwaInstall', () => {
  beforeEach(() => {
    vi.mocked(getDevicePlatform).mockReturnValue('windows');
    setupMatchMedia(false);
  });

  it('renders nothing on desktop without install prompt', () => {
    const { container } = render(<PwaInstall />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows Add to Home Screen hint on iOS', () => {
    vi.mocked(getDevicePlatform).mockReturnValue('ios');
    render(<PwaInstall />);
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
  });

  it('shows Install App button when beforeinstallprompt fires', async () => {
    render(<PwaInstall />);
    fireBeforeInstallPrompt();
    const button = await screen.findByRole('button', { name: /Install App/ });
    expect(button).toBeInTheDocument();
  });

  it('calls prompt() when Install App button is clicked', async () => {
    render(<PwaInstall />);
    const event = fireBeforeInstallPrompt();
    const button = await screen.findByRole('button', { name: /Install App/ });
    fireEvent.click(button);
    await vi.waitFor(() => expect(event.prompt).toHaveBeenCalled());
  });

  it('hides after appinstalled event', async () => {
    render(<PwaInstall />);
    fireBeforeInstallPrompt();
    await screen.findByRole('button', { name: /Install App/ });
    act(() => { window.dispatchEvent(new Event('appinstalled')); });
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: /Install App/ })).not.toBeInTheDocument());
  });

  it('renders nothing when already installed (standalone)', () => {
    setupMatchMedia(true);
    vi.mocked(getDevicePlatform).mockReturnValue('ios');
    const { container } = render(<PwaInstall />);
    expect(container).toBeEmptyDOMElement();
  });
});
