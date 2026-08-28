import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDevicePlatform } from '../../utils/device';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getDevicePlatform', () => {
  it('returns "windows" for Windows user agent', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
    expect(getDevicePlatform()).toBe('windows');
  });

  it('returns "android" for Android user agent', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G973F)' });
    expect(getDevicePlatform()).toBe('android');
  });

  it('returns "ios" for iPhone user agent', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' });
    expect(getDevicePlatform()).toBe('ios');
  });

  it('returns "ios" for iPad user agent', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)' });
    expect(getDevicePlatform()).toBe('ios');
  });

  it('returns "ios" for iPadOS 13+ Mac user agent with touch points', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 });
    expect(getDevicePlatform()).toBe('ios');
  });

  it('returns "other" for macOS user agent', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 });
    expect(getDevicePlatform()).toBe('other');
  });
});
