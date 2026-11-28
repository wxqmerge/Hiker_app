import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PopOutButton from '../../components/PopOutButton';
import { isEmbedded } from '../../utils/embed';

vi.mock('../../utils/embed', () => ({
  isEmbedded: vi.fn(() => false),
}));

describe('PopOutButton', () => {
  beforeEach(() => {
    vi.mocked(isEmbedded).mockReturnValue(false);
  });

  it('renders nothing in a top-level window', () => {
    const { container } = render(<PopOutButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a new-tab link when embedded in an iframe', () => {
    vi.mocked(isEmbedded).mockReturnValue(true);
    render(<PopOutButton />);
    const link = screen.getByText('Full site');
    expect(link.closest('a')).toHaveAttribute('target', '_blank');
    expect(link.closest('a')).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
