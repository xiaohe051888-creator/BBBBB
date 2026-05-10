import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const currentFile = fileURLToPath(import.meta.url);
const rootDir = resolve(dirname(currentFile), '../..');
const pwaDir = resolve(rootDir, 'public/pwa');

describe('pwa icon assets', () => {
  it('emits required raster icons with expected sizes', async () => {
    const files = [
      ['icon-192.png', 192],
      ['icon-512.png', 512],
      ['icon-maskable-512.png', 512],
      ['apple-touch-icon.png', 180],
    ] as const;

    for (const [fileName, expectedSize] of files) {
      const filePath = resolve(pwaDir, fileName);
      expect(existsSync(filePath)).toBe(true);
      const meta = await sharp(filePath).metadata();
      expect(meta.width).toBe(expectedSize);
      expect(meta.height).toBe(expectedSize);
    }
  });
});
