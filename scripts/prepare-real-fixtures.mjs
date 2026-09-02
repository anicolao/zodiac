import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(projectRoot, 'assets', 'examples');
const outputRoot = join(projectRoot, 'tests', 'fixtures', 'real', 'images');
const sourceFiles = (await readdir(sourceRoot))
  .filter((file) => /^IMG_\d+\.jpe?g$/i.test(file))
  .sort();

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  for (const sourceFile of sourceFiles) {
    const bytes = await readFile(join(sourceRoot, sourceFile));
    const encoded = bytes.toString('base64');
    const result = await page.evaluate(async ({ encodedImage, maxEdge }) => {
      const image = new Image();
      image.src = `data:image/jpeg;base64,${encodedImage}`;
      await image.decode();
      const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Canvas is unavailable.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return {
        width: canvas.width,
        height: canvas.height,
        encoded: canvas.toDataURL('image/jpeg', 0.88).split(',')[1]
      };
    }, { encodedImage: encoded, maxEdge: 1600 });
    const outputFile = sourceFile.toLowerCase();
    await writeFile(join(outputRoot, outputFile), Buffer.from(result.encoded, 'base64'));
    process.stdout.write(`${sourceFile} -> ${outputFile} (${result.width}x${result.height})\n`);
  }
} finally {
  await browser.close();
}
