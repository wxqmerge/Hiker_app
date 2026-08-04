import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PageNav from '../../components/PageNav';
import { setGroupConfig } from '../../utils/config';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...(actual as any),
    NavLink: ({ to, className, children }: any) => {
      const isActive = to === '/schedule';
      const cls = typeof className === 'function' ? className({ isActive }) : className;
      return (
        <a href={to} data-to={to} className={cls}>
          {children}
        </a>
      );
    },
  };
});

describe('PageNav', () => {
  beforeEach(() => {
    setGroupConfig({ name: null });
  });

  it('renders all 4 navigation links', () => {
    render(<PageNav />, { wrapper: MemoryRouter });
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('Browse Trails')).toBeInTheDocument();
    expect(screen.getByText('Trail Manager')).toBeInTheDocument();
    expect(screen.getByText('Schedule Builder')).toBeInTheDocument();
  });

  it('has correct link paths', () => {
    render(<PageNav />, { wrapper: MemoryRouter });
    expect(screen.getByText('Calendar').closest('a')).toHaveAttribute('href', '/');
    expect(screen.getByText('Browse Trails').closest('a')).toHaveAttribute('href', '/browse');
    expect(screen.getByText('Trail Manager').closest('a')).toHaveAttribute('href', '/trails');
    expect(screen.getByText('Schedule Builder').closest('a')).toHaveAttribute('href', '/schedule');
  });

  it('hides group name when not configured', () => {
    render(<PageNav />, { wrapper: MemoryRouter });
    expect(screen.queryByText('SOThH')).not.toBeInTheDocument();
  });

  it('shows group name when configured', () => {
    setGroupConfig({ name: 'SOThH' });
    render(<PageNav />, { wrapper: MemoryRouter });
    expect(screen.getByText('SOThH')).toBeInTheDocument();
  });

  it('has nav element with correct classes', () => {
    const { container } = render(<PageNav />, { wrapper: MemoryRouter });
    const nav = container.querySelector('nav');
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass('flex', 'items-baseline', 'gap-2', 'mb-6');
  });
});
