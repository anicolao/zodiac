import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { fixtureDevServer } from './src/lib/fixture-dev-server.js';

function buildHash() {
  if (process.env.VITE_GIT_HASH?.trim()) return process.env.VITE_GIT_HASH.trim();
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'development';
  }
}

export default defineConfig({
  plugins: [fixtureDevServer(), sveltekit()],
  define: {
    'import.meta.env.VITE_GIT_HASH': JSON.stringify(buildHash())
  }
});
