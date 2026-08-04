import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDevicePlatform } from '../../utils/device';

describe('getDevicePlatform', () => {
  const originalUA = navigator.userAgent;

  beforeEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUA,
      writable: true,
      configurable: true,
    });
  });

  it('returns windows for Windows user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      writable: true,
      configurable: true,
    });
    expect(getDevicePlatform()).toBe('windows');
  });

  it('returns mobile for Android user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 12; Pixel 6)',
      writable: true,
      configurable: true,
    });
    expect(getDevicePlatform()).toBe('mobile');
  });

  it('returns mobile for iPhone user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      writable: true,
      configurable: true,
    });
    expect(getDevicePlatform()).toBe('mobile');
  });

  it('returns mobile for iPad user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)',
      writable: true,
      configurable: true,
    });
    expect(getDevicePlatform()).toBe('mobile');
  });

  it('returns mobile for iPod user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 16_0 like Mac OS X)',
      writable: true,
      configurable: true,
    });
    expect(getDevicePlatform()).toBe('mobile');
  });

  it('returns other for macOS user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      writable: true,
      configurable: true,
    });
    expect(getDevicePlatform()).toBe('other');
  });

  it('returns other for Linux user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64)',
      writable: true,
      configurable: true,
    });
    expect(getDevicePlatform()).toBe('other');
  });
});
