import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = join(root, 'static', 'ocr');

await rm(staticRoot, { recursive: true, force: true });
await mkdir(join(staticRoot, 'core'), { recursive: true });
await mkdir(join(staticRoot, 'lang'), { recursive: true });

await cp(join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'), join(staticRoot, 'worker.min.js'));
for (const filename of ['tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm']) {
  await cp(
    join(root, 'node_modules', 'tesseract.js-core', filename),
    join(staticRoot, 'core', filename)
  );
}

const languageCandidates = [
  join(root, 'node_modules', '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'),
  join(root, 'node_modules', '@tesseract.js-data', 'eng', '4.0.0', 'eng.traineddata.gz')
];

let copied = false;
for (const candidate of languageCandidates) {
  try {
    await cp(candidate, join(staticRoot, 'lang', 'eng.traineddata.gz'));
    copied = true;
    break;
  } catch {}
}

if (!copied) {
  throw new Error('Unable to find the bundled English Tesseract language data.');
}
