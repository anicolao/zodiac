import { expect, test } from '@playwright/test';
import path from 'node:path';
import { TestStepHelper } from '../helpers/test-step-helper';

test.use({ serviceWorkers: 'allow' });

test('a Home Screen session recognizes a card after connectivity is lost', async ({ context, page }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Offline local recognition',
    'After one online app load, the service worker supplies the complete app shell and OCR assets while a gameplay photograph is processed offline.'
  );
  await page.goto('/');
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Service workers are unavailable');
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
      });
    }
  });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Start a game' }).click();
  await page.locator('#photo-input').setInputFiles(path.join(testInfo.config.rootDir, 'fixtures', 'castle.png'));
  await expect(page.getByRole('heading', { name: '5 stars found' })).toBeVisible({ timeout: 90000 });
  await steps.step('offline-castle', {
    description: 'The cached local pipeline reads CASTLE and all five tokens offline',
    verifications: [
      { spec: 'The printed card name is recognized with the network disabled', check: async () => expect(page.getByLabel('Printed card name')).toHaveValue('CASTLE') },
      { spec: 'Four small gold and one larger red star are detected offline', check: async () => {
        await expect(page.locator('.detected-star.gold')).toHaveCount(4);
        await expect(page.locator('.detected-star.red')).toHaveCount(1);
      } },
      { spec: 'The normalized capture remains confirmable', check: async () => expect(page.getByRole('button', { name: 'Keep photo' })).toBeEnabled() },
      { spec: 'The visible build marker distinguishes an offline freshness state', check: async () => {
        await expect(page.getByTestId('build-marker')).toHaveText('Build e2e-test');
        await expect(page.locator('.build-status')).toHaveAttribute('data-freshness', 'offline');
      } }
    ]
  });
  steps.generateDocs();
});
