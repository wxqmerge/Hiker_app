import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getStoredApiKey,
  hasStoredApiKey,
  storeApiKey,
  getApiKeyFromHash,
  hasPendingApiKeyFromHash,
  removeApiKeyFromLocation,
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
