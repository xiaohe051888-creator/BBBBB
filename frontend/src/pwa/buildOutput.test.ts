import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = resolve(dirname(currentFile), '../..');
const distDir = resolve(rootDir, 'dist');

describe('pwa build output', () => {
  it('ships manifest, service worker and icon assets in dist', () => {
    expect(existsSync(resolve(distDir, 'manifest.webmanifest'))).toBe(true);
    expect(existsSync(resolve(distDir, 'sw.js'))).toBe(true);
    expect(existsSync(resolve(distDir, 'pwa/icon-192.png'))).toBe(true);
    expect(existsSync(resolve(distDir, 'pwa/icon-512.png'))).toBe(true);

    const html = readFileSync(resolve(distDir, 'index.html'), 'utf8');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('name="theme-color"');
  });
});
