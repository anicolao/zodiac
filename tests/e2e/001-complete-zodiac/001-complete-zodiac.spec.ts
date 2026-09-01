import { expect, test } from '@playwright/test';
import path from 'node:path';
import { TestStepHelper } from '../helpers/test-step-helper';

const fixtures = [
  { file: 'castle.png', label: 'CASTLE', gold: 4, red: 1 },
  { file: 'dragon.png', label: 'DRAGON', gold: 5, red: 2 },
  { file: 'sailboat.png', label: 'SAILBOAT', gold: 3, red: 2 },
  { file: 'elephant.png', label: 'ELEPHANT', gold: 6, red: 1 },
  { file: 'guitar.png', label: 'GUITAR', gold: 4, red: 2 },
  { file: 'hot-air-balloon.png', label: 'HOT AIR BALLOON', gold: 5, red: 2 }
];

test('a complete six-card game becomes a shareable Zodiac', async ({ page }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Complete local Zodiac journey',
    'Six realistic gameplay photographs are read locally, confirmed, composed into the approved Zodiac artwork, persisted, and handed to the platform share action.'
  );
  const outsideRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '127.0.0.1') {
      outsideRequests.push(request.url());
    }
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files?.[0];
        (window as unknown as { __sharedZodiac?: unknown }).__sharedZodiac = file
          ? { name: file.name, type: file.type, size: file.size }
          : null;
      }
    });
  });

  await page.goto('/');
  await steps.step('welcome', {
    description: 'The private six-photo ritual starts with the approved celestial art direction',
    verifications: [
      { spec: 'The app has a stable accessible title', check: async () => expect(page).toHaveTitle('Zodiac — A game becomes a constellation') },
      { spec: 'The promise and local-only privacy statement are visible', check: async () => {
        await expect(page.getByRole('heading', { name: 'Zodiac' })).toBeVisible();
        await expect(page.getByText('A game becomes a constellation.')).toBeVisible();
        await expect(page.getByText(/Everything stays on this device/)).toBeVisible();
      } },
      { spec: 'The first action is touch-sized and named', check: async () => expect(page.getByRole('button', { name: 'Start a game' })).toBeVisible() }
    ]
  });

  await page.getByRole('button', { name: 'Start a game' }).click();
  for (let index = 0; index < fixtures.length; index += 1) {
    const fixture = fixtures[index];
    await expect(page.getByRole('heading', { name: 'Capture the table' })).toBeVisible();
    await page.locator('#photo-input').setInputFiles(path.join(testInfo.config.rootDir, 'fixtures', fixture.file));
    await expect(page.getByRole('heading', { name: `${fixture.gold + fixture.red} stars found` })).toBeVisible({ timeout: 90000 });
    await expect(page.getByLabel('Printed card name')).toHaveValue(fixture.label);
    await steps.step(`recognized-${fixture.label.toLowerCase().replaceAll(' ', '-')}`, {
      description: `${fixture.label} is read from its printed card and its sized tokens are found`,
      verifications: [
        { spec: `OCR reads ${fixture.label} from the fixture rather than filename or test input`, check: async () => expect(page.getByLabel('Printed card name')).toHaveValue(fixture.label) },
        { spec: `${fixture.gold} small gold stars are detected`, check: async () => expect(page.locator('.detected-star.gold')).toHaveCount(fixture.gold) },
        { spec: `${fixture.red} larger red stars are detected`, check: async () => expect(page.locator('.detected-star.red')).toHaveCount(fixture.red) },
        { spec: 'Every detected token has a positive recorded display size', check: async () => {
          const sizes = await page.locator('.detected-star').evaluateAll((stars) => stars.map((star) => star.getBoundingClientRect().width));
          expect(sizes.every((size) => size > 25)).toBe(true);
          expect(Math.max(...sizes)).toBeGreaterThan(Math.min(...sizes));
        } }
      ]
    });
    await page.getByRole('button', { name: 'Keep photo' }).click();
  }

  await steps.step('six-card-review', {
    description: 'The complete game is reviewed before generation',
    verifications: [
      { spec: 'All six OCR-derived card names are present', check: async () => {
        for (const fixture of fixtures) await expect(page.getByText(fixture.label, { exact: true })).toBeVisible();
      } },
      { spec: 'The summary preserves all 27 gold and 10 red tokens', check: async () => {
        await expect(page.getByLabel('27 gold and 10 red stars')).toBeVisible();
        await expect(page.getByText('37 stars')).toBeVisible();
      } },
      { spec: 'Generation is enabled only after six accepted captures', check: async () => expect(page.getByRole('button', { name: 'Generate Zodiac' })).toBeEnabled() }
    ]
  });

  await page.getByRole('button', { name: 'Generate Zodiac' }).click();
  await expect(page.getByRole('heading', { name: 'Your Zodiac' })).toBeVisible({ timeout: 30000 });
  await steps.step('completed-zodiac', {
    description: 'The approved square Zodiac is completed entirely on device',
    verifications: [
      { spec: 'The output is a complete 2048×2048 PNG preview', check: async () => {
        const dimensions = await page.locator('.result-image').evaluate((image) => ({
          width: (image as HTMLImageElement).naturalWidth,
          height: (image as HTMLImageElement).naturalHeight
        }));
        expect(dimensions).toEqual({ width: 2048, height: 2048 });
      } },
      { spec: 'The accessible summary reports all six constellations and 37 stars', check: async () => expect(page.getByText('Six constellations · 37 stars · rendered privately on this device')).toBeVisible() },
      { spec: 'No request leaves the application origin', check: async () => expect(outsideRequests).toEqual([]) }
    ]
  });

  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __sharedZodiac?: unknown }).__sharedZodiac)).toMatchObject({
    name: 'my-zodiac.png',
    type: 'image/png'
  });
  await page.reload();
  await steps.step('restored-result', {
    description: 'The completed keepsake survives an app reload and remains shareable',
    verifications: [
      { spec: 'IndexedDB restores the generated Zodiac without a server', check: async () => expect(page.getByRole('heading', { name: 'Your Zodiac' })).toBeVisible() },
      { spec: 'Share and save actions remain available', check: async () => {
        await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save image' })).toBeVisible();
      } },
      { spec: 'Restoration makes no external network request', check: async () => expect(outsideRequests).toEqual([]) }
    ]
  });

  steps.generateDocs();
});
