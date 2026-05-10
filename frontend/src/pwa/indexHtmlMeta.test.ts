import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentFile = fileURLToPath(import.meta.url);
const html = readFileSync(resolve(dirname(currentFile), '../../index.html'), 'utf8');

describe('index html pwa meta', () => {
  it('links the manifest and apple touch icon', () => {
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon" href="/pwa/apple-touch-icon.png"');
  });

  it('declares standalone friendly mobile meta tags', () => {
    expect(html).toContain('name="theme-color" content="#08101f"');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="智能百家乐"');
  });
});
