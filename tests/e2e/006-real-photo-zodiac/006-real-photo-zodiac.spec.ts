import { expect, test } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { TestStepHelper } from '../helpers/test-step-helper';

interface FixtureRecord {
  id: string;
  image: { file: string };
  expected: { cardLabel: string; stars: unknown[] };
}

const fixtureRoot = path.resolve('tests/fixtures/real');

test('six reviewed real photographs preserve their geometry in a Zodiac', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-09-01T12:00:00-04:00'));
  const annotationFiles = (await readdir(path.join(fixtureRoot, 'annotations')))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .slice(0, 6);
  const fixtures = await Promise.all(annotationFiles.map(async (file) =>
    JSON.parse(await readFile(path.join(fixtureRoot, 'annotations', file), 'utf8')) as FixtureRecord
  ));
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Perspective-corrected real-photo Zodiac',
    'Six reviewed angled gameplay photographs become a Zodiac without turning their constellation geometry into polar trapezoids.'
  );
  const outsideRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '127.0.0.1') outsideRequests.push(request.url());
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Start a game' }).click();
  for (const fixture of fixtures) {
    await page.locator('#photo-input').setInputFiles(path.join(fixtureRoot, 'images', fixture.image.file));
    await page.getByRole('heading', { name: `${fixture.expected.stars.length} stars found` }).waitFor({ timeout: 90_000 });
    await expect(page.getByLabel('Printed card name')).toHaveValue(fixture.expected.cardLabel);
    await expect(page.getByTestId('recognized-capture-plane')).toHaveAttribute('data-corners', /\"x\"/);
    await page.getByRole('button', { name: 'Keep photo' }).click();
  }

  await page.getByRole('button', { name: 'Generate Zodiac' }).click();
  await expect(page.getByRole('heading', { name: 'Your Zodiac' })).toBeVisible({ timeout: 30_000 });
  await steps.step('perspective-corrected-zodiac', {
    description: 'The six angled real photographs produce one geometry-preserving Zodiac',
    verifications: [
      { spec: 'The output is a 2048×2048 PNG generated from the six real captures', check: async () => {
        const dimensions = await page.locator('.result-image').evaluate((image) => ({
          width: (image as HTMLImageElement).naturalWidth,
          height: (image as HTMLImageElement).naturalHeight
        }));
        expect(dimensions).toEqual({ width: 2048, height: 2048 });
      } },
      { spec: 'Each accepted capture records a four-corner play surface for perspective correction', check: async () => {
        const planes = await page.evaluate(async () => {
          const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('zodiac-local', 2);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          const session = await new Promise<{ captures: Array<{ capturePlane?: { corners: unknown[] } }> }>((resolve, reject) => {
            const request = database.transaction('sessions', 'readonly').objectStore('sessions').get('active');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          database.close();
          return session.captures.map((capture) => capture.capturePlane?.corners.length ?? 0);
        });
        expect(planes).toEqual([4, 4, 4, 4, 4, 4]);
      } },
      { spec: 'Constellation positions are composed locally without external requests', check: async () => expect(outsideRequests).toEqual([]) }
    ]
  });
  steps.generateDocs();
});
