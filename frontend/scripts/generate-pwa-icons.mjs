import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(here, '..');
const outputDir = resolve(rootDir, 'public/pwa');
const sourcePath = resolve(outputDir, 'icon-source.svg');

await mkdir(outputDir, { recursive: true });

const sourceSvg = await readFile(sourcePath);

const targets = [
  { fileName: 'icon-192.png', size: 192 },
  { fileName: 'icon-512.png', size: 512 },
  { fileName: 'icon-maskable-512.png', size: 512, fit: 'contain' },
  { fileName: 'apple-touch-icon.png', size: 180 },
];

for (const target of targets) {
  const fit = target.fit ?? 'cover';

  await sharp(sourceSvg, { density: 384 })
    .resize(target.size, target.size, {
      fit,
      background: { r: 6, g: 16, b: 31, alpha: 1 },
    })
    .png()
    .toFile(resolve(outputDir, target.fileName));
}

console.log(`Generated ${targets.length} PWA icons in ${outputDir}`);
