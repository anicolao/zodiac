import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { TestStepHelper } from '../helpers/test-step-helper';

interface FixtureExpectation {
  file: string;
  words: string[];
  die: number;
  selected: string;
  gold: number;
  red: number;
}

const fixtureRoot = path.resolve('tests/fixtures/issues');

test('numbered cards and dice select exactly one word at every camera rotation', async ({ page }, testInfo) => {
  const fixtures = JSON.parse(await readFile(path.join(fixtureRoot, 'expectations.json'), 'utf8')) as FixtureExpectation[];
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Numbered card and die recognition',
    'Twelve reported iPhone photographs are oriented with the card above the constellation, all six blue words are read, and the upward black-die value selects one word.'
  );
  const outsideRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '127.0.0.1') outsideRequests.push(request.url());
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Start a game' }).click();
  for (const [index, fixture] of fixtures.entries()) {
    await page.locator('#photo-input').setInputFiles(path.join(fixtureRoot, 'images', fixture.file));
    await page.getByRole('heading', { name: `${fixture.gold + fixture.red} stars found` }).waitFor({ timeout: 90_000 });
    const choices = page.getByTestId('recognized-card-choices');
    await steps.step(`selected-${fixture.file.replace('.jpg', '')}`, {
      description: `${fixture.file} selects ${fixture.selected} from die ${fixture.die}`,
      verifications: [
        { spec: `All six printed blue words are read in numbered order`, check: async () => {
          expect(JSON.parse(await choices.getAttribute('data-words') ?? '[]')).toEqual(fixture.words);
        } },
        { spec: `The upward die face is ${fixture.die}`, check: async () => {
          await expect(choices).toHaveAttribute('data-die-value', String(fixture.die));
        } },
        { spec: `Only ${fixture.selected}, without its gold number, enters the text field`, check: async () => {
          await expect(page.getByLabel('Printed card name')).toHaveValue(fixture.selected);
        } },
        { spec: `The constellation retains ${fixture.gold} gold and ${fixture.red} red tokens`, check: async () => {
          await expect(page.locator('.detected-star.gold')).toHaveCount(fixture.gold);
          await expect(page.locator('.detected-star.red')).toHaveCount(fixture.red);
        } },
        { spec: 'Recognition remains entirely on this device', check: async () => expect(outsideRequests).toEqual([]) }
      ]
    });
    if (index < fixtures.length - 1) {
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Retake' }).click();
      await chooser;
    }
  }

  const sourceUrl = await page.locator('.photo-frame img').getAttribute('src');
  if (!sourceUrl) throw new Error('The final issue photograph preview is unavailable.');
  const cardFreeBytes = await page.evaluate(async (sourceUrl) => {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();
    const sourceY = Math.round(image.naturalHeight * 0.42);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight - sourceY;
    canvas.getContext('2d')?.drawImage(image, 0, sourceY, image.naturalWidth, canvas.height, 0, 0, canvas.width, canvas.height);
    return Array.from(new Uint8Array(await (await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create card-free fixture.')), 'image/jpeg', 0.9)
    )).arrayBuffer()));
  }, sourceUrl);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Retake' }).click();
  await (await chooser).setFiles({ name: 'no-card.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(cardFreeBytes) });
  await page.getByRole('heading', { name: /stars found/ }).waitFor({ timeout: 90_000 });
  await steps.step('no-card-no-gibberish', {
    description: 'A photograph without a card never invents a label',
    verifications: [
      { spec: 'The card-name text field is empty', check: async () => expect(page.getByLabel('Printed card name')).toHaveValue('') },
      { spec: 'No six-word or die result is reported', check: async () => expect(page.getByTestId('recognized-card-choices')).toHaveCount(0) },
      { spec: 'The empty card name prevents accidental confirmation', check: async () => expect(page.getByRole('button', { name: 'Keep photo' })).toBeDisabled() },
      { spec: 'The card-free check remains entirely local', check: async () => expect(outsideRequests).toEqual([]) }
    ]
  });
  steps.generateDocs();
});
