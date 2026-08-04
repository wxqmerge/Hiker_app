import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from '../../components/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders default message', () => {
    render(<LoadingSpinner />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders custom message', () => {
    render(<LoadingSpinner message="Please wait..." />);
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('renders spinner element', () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('has correct spinner styling', () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner.className).toContain('rounded-full');
    expect(spinner.className).toContain('border-green-600');
  });

  it('centers content', () => {
    const { container } = render(<LoadingSpinner />);
    const outer = container.firstChild;
    expect(outer.className).toContain('flex');
    expect(outer.className).toContain('items-center');
    expect(outer.className).toContain('justify-center');
  });
});
