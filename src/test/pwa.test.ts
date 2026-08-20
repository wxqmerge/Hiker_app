import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..');
const publicDir = resolve(projectRoot, 'public');

describe('PWA', () => {
  it('manifest is valid JSON with required installability fields', () => {
    const manifest = JSON.parse(readFileSync(resolve(publicDir, 'manifest.webmanifest'), 'utf-8'));
    expect(manifest.name).toBe('Hiker');
    expect(manifest.short_name).toBe('Hiker');
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#1b4332');
    expect(manifest.background_color).toBe('#ffffff');
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  });

  it('service worker exists and contains the expected caching logic', () => {
    const sw = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
    expect(sw).toContain('hiker-shell-');
    expect(sw).toContain('hiker-api-');
    expect(sw).toContain('hiker-tide-');
    expect(sw).toContain('skipWaiting');
    expect(sw).toContain('clients.claim');
    expect(sw).toContain('/api/schedule');
    expect(sw).toContain('api.tidesandcurrents.noaa.gov');
    expect(sw).toContain('api.weather.gov');
  });

  it('icons exist and are valid PNGs at the expected sizes', () => {
    for (const size of [192, 512]) {
      const iconPath = resolve(publicDir, 'icons', `icon-${size}.png`);
      expect(existsSync(iconPath)).toBe(true);
      const buf = readFileSync(iconPath);
      expect(buf.slice(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(buf.readUInt32BE(16)).toBe(size);
      expect(buf.readUInt32BE(20)).toBe(size);
    }
  });

  it('index.html references the manifest, theme color, and iOS meta tags', () => {
    const html = readFileSync(resolve(projectRoot, 'index.html'), 'utf-8');
    expect(html).toContain('manifest.webmanifest');
    expect(html).toContain('theme-color');
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('apple-touch-icon');
  });

  it('main.jsx registers the service worker in production only', () => {
    const main = readFileSync(resolve(projectRoot, 'src', 'main.jsx'), 'utf-8');
    expect(main).toContain("import.meta.env.PROD");
    expect(main).toContain('serviceWorker');
    expect(main).toContain('sw.js');
    expect(main).toContain('BASE_URL');
  });
});
