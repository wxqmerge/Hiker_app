import { describe, it, expect, vi } from 'vitest';
import { getDevicePlatform } from '../../utils/device';
 
 describe('getDevicePlatform', () => {
   it('returns "windows" for Windows user agent', () => {
     vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
     expect(getDevicePlatform()).toBe('windows');
   });
 
   it('returns "mobile" for Android user agent', () => {
     vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G973F)' });
     expect(getDevicePlatform()).toBe('mobile');
   });
 
   it('returns "mobile" for iPhone user agent', () => {
     vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' });
     expect(getDevicePlatform()).toBe('mobile');
   });
 
   it('returns "other" for macOS user agent', () => {
     vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' });
     expect(getDevicePlatform()).toBe('other');
   });
 });