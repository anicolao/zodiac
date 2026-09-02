import { expect, test } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { TestStepHelper } from '../helpers/test-step-helper';

interface Point { x: number; y: number }
interface ExpectedStar { color: 'gold' | 'red'; center: Point; radius: number }
interface FixtureRecord {
  id: string;
  image: { file: string };
  expected: {
    cardLabel: string;
    textRegion: { center: Point; width: number; height: number; rotationDegrees: number };
    stars: ExpectedStar[];
  };
}
interface ActualStar { color: 'gold' | 'red'; x: number; y: number; size: number }

const fixtureRoot = path.resolve('tests/fixtures/real');

function rotationDifference(left: number, right: number) {
  return Math.abs(((left - right + 270) % 180) - 90);
}

function matchStars(expected: ExpectedStar[], actual: ActualStar[]) {
  const remaining = [...actual];
  return expected.map((star) => {
    const candidates = remaining
      .map((candidate, index) => ({
        candidate,
        index,
        distance: Math.hypot(candidate.x - star.center.x, candidate.y - star.center.y)
      }))
      .filter(({ candidate }) => candidate.color === star.color)
      .sort((left, right) => left.distance - right.distance);
    const nearest = candidates[0];
    if (!nearest) throw new Error(`No ${star.color} detection remains for an expected token.`);
    remaining.splice(nearest.index, 1);
    return {
      centerError: nearest.distance,
      radiusError: Math.abs(nearest.candidate.size / 2 - star.radius)
    };
  });
}

test('the reviewed real photographs are recognized locally', async ({ page }, testInfo) => {
  const annotationFiles = (await readdir(path.join(fixtureRoot, 'annotations')))
    .filter((file) => file.endsWith('.json'))
    .sort();
  const fixtures = await Promise.all(annotationFiles.map(async (file) =>
    JSON.parse(await readFile(path.join(fixtureRoot, 'annotations', file), 'utf8')) as FixtureRecord
  ));
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Real-photo recognition regression',
    'Every reviewed gameplay photograph is processed through the same local browser pipeline used after an iPhone capture.'
  );
  const outsideRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '127.0.0.1') outsideRequests.push(request.url());
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Start a game' }).click();

  for (let index = 0; index < fixtures.length; index += 1) {
    const fixture = fixtures[index];
    const image = path.join(fixtureRoot, 'images', fixture.image.file);
    if (index === 0) {
      await page.locator('#photo-input').setInputFiles(image);
    } else {
      const chooserPromise = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Retake' }).click();
      await (await chooserPromise).setFiles(image);
    }

    await page.getByRole('heading', { name: `${fixture.expected.stars.length} stars found` }).waitFor({ timeout: 90_000 });
    const actualStars = await page.locator('.detected-star').evaluateAll((nodes) => nodes.map((node) => ({
      color: node.classList.contains('gold') ? 'gold' as const : 'red' as const,
      x: Number(node.getAttribute('data-star-x')),
      y: Number(node.getAttribute('data-star-y')),
      size: Number(node.getAttribute('data-star-size'))
    })));
    const textRegion = await page.getByTestId('recognized-text-region').evaluate((node) => ({
      center: {
        x: Number(node.getAttribute('data-center-x')),
        y: Number(node.getAttribute('data-center-y'))
      },
      width: Number(node.getAttribute('data-width')),
      height: Number(node.getAttribute('data-height')),
      rotationDegrees: Number(node.getAttribute('data-rotation-degrees'))
    }));
    const matched = matchStars(fixture.expected.stars, actualStars);
    const expectedGold = fixture.expected.stars.filter((star) => star.color === 'gold').length;
    const expectedRed = fixture.expected.stars.filter((star) => star.color === 'red').length;

    await steps.step(`recognized-${fixture.id}`, {
      description: `${fixture.expected.cardLabel} is read with its card direction and physical tokens intact`,
      verifications: [
        { spec: `OCR reads ${fixture.expected.cardLabel} from the arbitrarily placed printed card`, check: async () => {
          await expect(page.getByLabel('Printed card name')).toHaveValue(fixture.expected.cardLabel);
        } },
        { spec: `The detector finds exactly ${expectedGold} gold and ${expectedRed} red tokens`, check: async () => {
          await expect(page.locator('.detected-star.gold')).toHaveCount(expectedGold);
          await expect(page.locator('.detected-star.red')).toHaveCount(expectedRed);
        } },
        { spec: 'Every token center and physical radius matches the reviewed annotation', check: async () => {
          expect(Math.max(...matched.map(({ centerError }) => centerError))).toBeLessThanOrEqual(0.022);
          expect(Math.max(...matched.map(({ radiusError }) => radiusError))).toBeLessThanOrEqual(0.022);
        } },
        { spec: 'The text location and card-defined north match the reviewed annotation', check: async () => {
          expect(Math.hypot(
            textRegion.center.x - fixture.expected.textRegion.center.x,
            textRegion.center.y - fixture.expected.textRegion.center.y
          )).toBeLessThanOrEqual(0.025);
          expect(rotationDifference(textRegion.rotationDegrees, fixture.expected.textRegion.rotationDegrees)).toBeLessThanOrEqual(8);
          expect(Math.abs(textRegion.width - fixture.expected.textRegion.width)).toBeLessThanOrEqual(0.04);
          expect(Math.abs(textRegion.height - fixture.expected.textRegion.height)).toBeLessThanOrEqual(0.06);
        } },
        { spec: 'Recognition sends no photograph or derived data off device', check: async () => expect(outsideRequests).toEqual([]) }
      ]
    });
  }

  steps.generateDocs();
});
