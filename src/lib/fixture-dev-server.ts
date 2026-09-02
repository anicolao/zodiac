import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixtureRoot = join(projectRoot, 'tests', 'fixtures', 'real');
const annotationRoot = join(fixtureRoot, 'annotations');
const imageRoot = join(fixtureRoot, 'images');
const safeName = /^[a-z0-9][a-z0-9_.-]*$/i;

function json(response: import('node:http').ServerResponse, status: number, value: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

async function body(request: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += value.length;
    if (size > 1_000_000) throw new Error('Annotation payload is too large.');
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function fixtureDevServer(): Plugin {
  return {
    name: 'zodiac-fixture-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        const marker = '/__fixtures/';
        const markerIndex = pathname.indexOf(marker);
        if (markerIndex < 0) return next();
        const fixturePath = pathname.slice(markerIndex + marker.length);
        try {
          if (request.method === 'GET' && fixturePath === 'manifest.json') {
            const files = (await readdir(annotationRoot)).filter((file) => file.endsWith('.json')).sort();
            const fixtures = await Promise.all(
              files.map(async (file) => JSON.parse(await readFile(join(annotationRoot, file), 'utf8')))
            );
            return json(response, 200, { fixtures });
          }

          const imageMatch = /^images\/([^/]+)$/.exec(fixturePath);
          if (request.method === 'GET' && imageMatch && safeName.test(imageMatch[1])) {
            const image = await readFile(join(imageRoot, imageMatch[1]));
            response.statusCode = 200;
            response.setHeader('Content-Type', extname(imageMatch[1]).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg');
            response.setHeader('Cache-Control', 'no-store');
            response.end(image);
            return;
          }

          const annotationMatch = /^annotations\/([a-z0-9][a-z0-9_-]*)\.json$/i.exec(fixturePath);
          if (request.method === 'POST' && annotationMatch) {
            const annotation = await body(request);
            if (!annotation || typeof annotation !== 'object' || !('id' in annotation) || annotation.id !== annotationMatch[1]) {
              return json(response, 400, { error: 'Annotation id does not match its filename.' });
            }
            const expected = 'expected' in annotation && annotation.expected && typeof annotation.expected === 'object'
              ? annotation.expected
              : undefined;
            const textRegion = expected && 'textRegion' in expected && expected.textRegion && typeof expected.textRegion === 'object'
              ? expected.textRegion
              : undefined;
            if (!textRegion || !('center' in textRegion) || !('width' in textRegion) || !('height' in textRegion) || !('rotationDegrees' in textRegion)) {
              return json(response, 400, { error: 'Annotation must use the current rectangular text-region schema.' });
            }
            Object.assign(annotation, { schemaVersion: 2 });
            await mkdir(annotationRoot, { recursive: true });
            await writeFile(join(annotationRoot, `${annotationMatch[1]}.json`), `${JSON.stringify(annotation, null, 2)}\n`);
            return json(response, 200, { saved: annotationMatch[1] });
          }

          return json(response, 404, { error: 'Fixture resource not found.' });
        } catch (error) {
          server.config.logger.error(error instanceof Error ? error.stack ?? error.message : String(error));
          return json(response, 500, { error: error instanceof Error ? error.message : 'Fixture server failed.' });
        }
      });
    }
  };
}
