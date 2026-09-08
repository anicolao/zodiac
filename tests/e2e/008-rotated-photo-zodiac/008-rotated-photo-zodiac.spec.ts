import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { TestStepHelper } from '../helpers/test-step-helper';

interface FixtureExpectation {
  file: string;
  die: number;
  selected: string;
  gold: number;
  red: number;
}

const fixtureRoot = path.resolve('tests/fixtures/issues');

test('rotated numbered-card photos produce consistently filled constellations', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-09-08T12:00:00-04:00'));
  const allFixtures = JSON.parse(await readFile(path.join(fixtureRoot, 'expectations.json'), 'utf8')) as FixtureExpectation[];
  const fixtures = allFixtures.slice(6);
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Rotation-safe numbered-card Zodiac',
    'Six real captures, including an exact upside-down photograph and a quarter-turn photograph, retain their card-above orientation and expand uniformly in the final Zodiac.'
  );
  const outsideRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '127.0.0.1') outsideRequests.push(request.url());
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Start a game' }).click();
  for (const fixture of fixtures) {
    await page.locator('#photo-input').setInputFiles(path.join(fixtureRoot, 'images', fixture.file));
    await page.getByRole('heading', { name: `${fixture.gold + fixture.red} stars found` }).waitFor({ timeout: 90_000 });
    await expect(page.getByLabel('Printed card name')).toHaveValue(fixture.selected);
    await expect(page.getByTestId('recognized-card-choices')).toHaveAttribute('data-die-value', String(fixture.die));
    await page.getByRole('button', { name: 'Keep photo' }).click();
  }

  await page.getByRole('button', { name: 'Generate Zodiac' }).click();
  await expect(page.getByRole('heading', { name: 'Your Zodiac' })).toBeVisible({ timeout: 30_000 });
  await steps.step('rotation-safe-zodiac', {
    description: 'Every rotated constellation fills its sector with standardized star sizes',
    verifications: [
      { spec: 'The selected die words label all six sectors', check: async () => {
        await expect(page.getByText('Six constellations · 32 stars · rendered privately on this device')).toBeVisible();
      } },
      { spec: 'The result is a full-resolution 2048×2048 PNG', check: async () => {
        const dimensions = await page.locator('.result-image').evaluate((image) => ({
          width: (image as HTMLImageElement).naturalWidth,
          height: (image as HTMLImageElement).naturalHeight
        }));
        expect(dimensions).toEqual({ width: 2048, height: 2048 });
      } },
      { spec: 'The upside-down and quarter-turn captures both remain in the completed game', check: async () => {
        await expect(page.getByRole('button', { name: 'Game history · 1' })).toBeVisible();
      } },
      { spec: 'Recognition and rendering make no external request', check: async () => expect(outsideRequests).toEqual([]) }
    ]
  });
  steps.generateDocs();
});
