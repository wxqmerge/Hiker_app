import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredApiKey, hasStoredApiKey, storeApiKey } from '../../utils/apiKey';

describe('apiKey utils', () => {
  beforeEach(() => {
    localStorage.clear();
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
});
