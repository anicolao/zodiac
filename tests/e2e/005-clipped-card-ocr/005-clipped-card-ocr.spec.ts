import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { TestStepHelper } from '../helpers/test-step-helper';

test('a slightly clipped card still supplies its printed name', async ({ page }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Clipped-card OCR',
    'A card may touch the photograph edge without losing its printed name when the word itself remains visible.'
  );
  await page.goto('/');
  const encoded = (await readFile(path.resolve('tests/fixtures/real/images/img_0936.jpg'))).toString('base64');
  const croppedBytes = await page.evaluate(async (source) => {
    const bytes = Uint8Array.from(atob(source), (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height - 300;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(bitmap, 0, -300);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error('Crop failed')),
      'image/jpeg',
      0.9
    ));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, encoded);

  await page.getByRole('button', { name: 'Start a game' }).click();
  await page.locator('#photo-input').setInputFiles({
    name: 'clipped-cake.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(croppedBytes)
  });
  await page.getByRole('heading', { name: '5 stars found' }).waitFor({ timeout: 90_000 });
  await steps.step('recognized-clipped-cake', {
    description: 'CAKE is read even though the upper card border is outside the photograph',
    verifications: [
      { spec: 'OCR reads the fully visible printed word', check: async () => expect(page.getByLabel('Printed card name')).toHaveValue('CAKE') },
      { spec: 'The partial card is still localized with a usable direction', check: async () => expect(page.getByTestId('recognized-text-region')).toHaveCount(1) },
      { spec: 'All five constellation tokens remain detected', check: async () => expect(page.locator('.detected-star')).toHaveCount(5) }
    ]
  });
  steps.generateDocs();
});
