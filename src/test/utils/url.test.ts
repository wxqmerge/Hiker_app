import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getApiBase, getGoogleAllTrailsSearchUrl } from '../../utils/url';

vi.mock('react');

describe('getApiBase', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'location', {
      value: { hostname: '', pathname: '' },
      writable: true,
      configurable: true,
    });
  });

  it('returns empty string for localhost', () => {
    Object.defineProperty(globalThis, 'location', {
      value: { hostname: 'localhost', pathname: '/' },
      writable: true,
      configurable: true,
    });
    expect(getApiBase()).toBe('');
  });

  it('returns https URL for subdomain of example.com', () => {
    Object.defineProperty(globalThis, 'location', {
      value: { hostname: 'sothh-dev.example.com', pathname: '/' },
      writable: true,
      configurable: true,
    });
    expect(getApiBase()).toBe('https://sothh-dev.example.com');
  });

  it('returns empty string for non-example.com domain', () => {
    Object.defineProperty(globalThis, 'location', {
      value: { hostname: 'example.com', pathname: '/' },
      writable: true,
      configurable: true,
    });
    expect(getApiBase()).toBe('');
  });

  it('extracts subdomain from path for non-subdomain deployments', () => {
    Object.defineProperty(globalThis, 'location', {
      value: { hostname: 'example.com', pathname: '/sothh-dev/some/path' },
      writable: true,
      configurable: true,
    });
    expect(getApiBase()).toBe('https://sothh-dev.example.com');
  });

  it('extracts app name from path for any prefix', () => {
    Object.defineProperty(globalThis, 'location', {
      value: { hostname: 'example.com', pathname: '/sothh-app/some/path' },
      writable: true,
      configurable: true,
    });
    expect(getApiBase()).toBe('https://sothh-app.example.com');
  });

  it('extracts hiker prefix from path', () => {
    Object.defineProperty(globalThis, 'location', {
      value: { hostname: 'example.com', pathname: '/hiker/some/path' },
      writable: true,
      configurable: true,
    });
    expect(getApiBase()).toBe('https://hiker.example.com');
  });
});

describe('getGoogleAllTrailsSearchUrl', () => {
  it('returns empty string for empty input', () => {
    expect(getGoogleAllTrailsSearchUrl('')).toBe('');
    expect(getGoogleAllTrailsSearchUrl(null)).toBe('');
    expect(getGoogleAllTrailsSearchUrl(undefined)).toBe('');
  });

  it('returns google search URL with encoded query', () => {
    const url = getGoogleAllTrailsSearchUrl('Mount Rainier');
    expect(url).toContain('https://www.google.com/search?q=');
    expect(url).toContain('alltrails.com%2Bwashington');
    expect(url).toContain('Mount');
    expect(url).toContain('Rainier');
  });

  it('encodes special characters', () => {
    const url = getGoogleAllTrailsSearchUrl('Trail & Path');
    expect(url).toContain('https://www.google.com/search?q=');
    expect(url).toContain('alltrails.com%2Bwashington');
  });
});
