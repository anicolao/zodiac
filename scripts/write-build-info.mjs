import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function resolveHash() {
  if (process.env.VITE_GIT_HASH?.trim()) return process.env.VITE_GIT_HASH.trim();
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'development';
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildInfo = {
  hash: resolveHash(),
  builtAt: new Date().toISOString()
};

await writeFile(join(root, 'static', 'build.json'), `${JSON.stringify(buildInfo, null, 2)}\n`);
