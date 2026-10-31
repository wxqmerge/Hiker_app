import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getStoredApiKey,
  hasStoredApiKey,
  storeApiKey,
  getApiKeyFromHash,
  hasPendingApiKeyFromHash,
  removeApiKeyFromLocation,
  isStoredApiKeyVerified,
  API_KEY_TTL_MS,
} from '../../utils/apiKey';

describe('apiKey utils', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  describe('getStoredApiKey', () => {
    it('returns empty string when no key stored', () => {
      expect(getStoredApiKey()).toBe('');
    });

    it('returns the stored key', () => {
      localStorage.setItem('hiker-api-key', 'test-key-123');
      expect(getStoredApiKey()).toBe('test-key-123');
    });
  });

  describe('hasStoredApiKey', () => {
    it('returns false when no key stored', () => {
      expect(hasStoredApiKey()).toBe(false);
    });

    it('returns true when a key is stored', () => {
      localStorage.setItem('hiker-api-key', 'test-key-123');
      expect(hasStoredApiKey()).toBe(true);
    });

    it('returns false for empty string key', () => {
      localStorage.setItem('hiker-api-key', '');
      expect(hasStoredApiKey()).toBe(false);
    });

    it('returns false for whitespace-only key', () => {
      localStorage.setItem('hiker-api-key', '   ');
      expect(hasStoredApiKey()).toBe(false);
    });
  });

  describe('storeApiKey', () => {
    it('stores a non-empty key', () => {
      storeApiKey('test-key-123');
      expect(getStoredApiKey()).toBe('test-key-123');
      expect(hasStoredApiKey()).toBe(true);
    });

    it('removes the key when given an empty string', () => {
      localStorage.setItem('hiker-api-key', 'old-key');
      storeApiKey('');
      expect(localStorage.getItem('hiker-api-key')).toBeNull();
      expect(hasStoredApiKey()).toBe(false);
    });

    it('removes the key when given null', () => {
      localStorage.setItem('hiker-api-key', 'old-key');
      storeApiKey(null);
      expect(localStorage.getItem('hiker-api-key')).toBeNull();
    });

    it('removes the key when given undefined', () => {
      localStorage.setItem('hiker-api-key', 'old-key');
      storeApiKey(undefined);
      expect(localStorage.getItem('hiker-api-key')).toBeNull();
    });

    it('removes the key when given whitespace only', () => {
      localStorage.setItem('hiker-api-key', 'old-key');
      storeApiKey('   ');
      expect(localStorage.getItem('hiker-api-key')).toBeNull();
    });

    it('overwrites an existing key', () => {
      storeApiKey('old-key');
      storeApiKey('new-key');
      expect(getStoredApiKey()).toBe('new-key');
    });

    it('trims stored keys', () => {
      storeApiKey('  test-key  ');
      expect(localStorage.getItem('hiker-api-key')).toBe('test-key');
      expect(getStoredApiKey()).toBe('test-key');
    });

    it('tracks whether the stored key has been verified', () => {
      storeApiKey('  verified-key  ', { verified: true });
      expect(getStoredApiKey()).toBe('verified-key');
      expect(isStoredApiKeyVerified()).toBe(true);

      storeApiKey('verified-key');
      expect(isStoredApiKeyVerified()).toBe(false);
    });
  });

  describe('hash key import', () => {
    const setLocation = (href: string) => {
      const url = new URL(href);
      Object.assign(window.location, {
        protocol: url.protocol,
        origin: url.origin,
        hostname: url.hostname,
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        href: url.href,
      });
    };

    it('reads apikey and key fragments', () => {
      setLocation('http://localhost/app/?x=1#apikey=hash-key');
      expect(getApiKeyFromHash()).toBe('hash-key');
      expect(hasPendingApiKeyFromHash()).toBe(true);

      setLocation('http://localhost/app/#key=short-key');
      expect(getApiKeyFromHash()).toBe('short-key');
      expect(hasPendingApiKeyFromHash()).toBe(true);
    });

    it('removes only the key fragment without storing it', () => {
      setLocation('http://localhost/app/?x=1#apikey=secret');
      vi.spyOn(window.history, 'replaceState').mockImplementation((_state, _title, url) => {
        setLocation(String(url));
      });

      removeApiKeyFromLocation();

      expect(window.location.pathname).toBe('/app/');
      expect(window.location.search).toBe('?x=1');
      expect(window.location.hash).toBe('');
      expect(getStoredApiKey()).toBe('');
    });
  });
});

describe('apiKey TTL', () => {
  it('expires a stored key after the TTL and clears storage', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      storeApiKey('ttl-key', { verified: true });
      expect(getStoredApiKey()).toBe('ttl-key');

      vi.setSystemTime(new Date(Date.now() + API_KEY_TTL_MS + 1000));
      expect(getStoredApiKey()).toBe('');
      expect(hasStoredApiKey()).toBe(false);
      expect(localStorage.getItem('hiker-api-key')).toBeNull();
      expect(localStorage.getItem('hiker-api-key-ts')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stamps and accepts keys stored before the TTL existed', () => {
    localStorage.setItem('hiker-api-key', 'legacy-key');
    expect(getStoredApiKey()).toBe('legacy-key');
    expect(localStorage.getItem('hiker-api-key-ts')).toBeTruthy();
  });
});
