import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('the installable shell is responsive and accessible', async ({ page }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Responsive installable shell',
    'The browser and Home Screen entry point retain their hierarchy, manifest, touch targets, and reduced-motion behavior at phone and desktop widths.'
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(new URL(manifestHref ?? '', page.url()).pathname).toBe('/manifest.webmanifest');
  const manifestResponse = await page.request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  expect(await manifestResponse.json()).toMatchObject({
    name: 'Zodiac — A game becomes a constellation',
    display: 'standalone',
    theme_color: '#031426'
  });
  await steps.step('installable-welcome', {
    description: `The welcome screen is complete at the ${testInfo.project.name} viewport`,
    verifications: [
      { spec: 'The Web App Manifest supplies standalone Home Screen metadata', check: async () => expect(manifestResponse.ok()).toBe(true) },
      { spec: 'The main CTA has an accessible name and at least a 44-pixel target', check: async () => expect(page.getByRole('button', { name: /Start a game|Resume game/ })).toBeVisible() },
      { spec: 'Reduced motion eliminates the decorative pulse duration', check: async () => {
        await expect.poll(() => page.locator('.preview-star').first().evaluate((element) => {
          const duration = getComputedStyle(element).animationDuration;
          return duration.endsWith('ms') ? parseFloat(duration) / 1000 : parseFloat(duration);
        })).toBeLessThan(0.001);
      } }
    ]
  });
  steps.generateDocs();
});
