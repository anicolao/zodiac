export interface BuildInfo {
  hash: string;
  builtAt: string;
  source?: 'network' | 'cache';
}

export const BUILD_HASH = (import.meta.env.VITE_GIT_HASH || 'development').trim();

export function shortBuildHash(hash = BUILD_HASH): string {
  return hash === 'development' ? hash : hash.slice(0, 8);
}

export function isDifferentBuild(deployedHash: string, currentHash = BUILD_HASH): boolean {
  const deployed = deployedHash.trim();
  const current = currentHash.trim();
  return Boolean(deployed && current && deployed !== 'development' && current !== 'development' && deployed !== current);
}

function buildInfoUrl(now = Date.now()): URL {
  const manifestHref = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href;
  const url = new URL('build.json', new URL('.', manifestHref ?? location.href));
  url.searchParams.set('check', String(now));
  return url;
}

export async function fetchDeployedBuild(now = Date.now()): Promise<BuildInfo> {
  const response = await fetch(buildInfoUrl(now), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Build check failed with status ${response.status}.`);
  const info = (await response.json()) as Partial<BuildInfo>;
  if (typeof info.hash !== 'string' || typeof info.builtAt !== 'string') {
    throw new Error('Build check returned invalid metadata.');
  }
  return {
    hash: info.hash,
    builtAt: info.builtAt,
    source: response.headers.get('X-Zodiac-Build-Source') === 'cache' ? 'cache' : 'network'
  };
}
