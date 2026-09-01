/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const worker = globalThis as unknown as ServiceWorkerGlobalScope;
const cacheName = `zodiac-${version}`;
const appRoot = new URL('./', worker.location.href).pathname;
const buildInfoPath = `${appRoot}build.json`;
const assets = [...build, ...files, appRoot];

worker.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(assets)));
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)));
      await worker.clients.claim();
    })
  );
});

worker.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVATE_UPDATE') void worker.skipWaiting();
});

worker.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== worker.location.origin) return;
  if (url.pathname === buildInfoPath) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(async (error) => {
        const cached = await caches.match(buildInfoPath);
        if (cached) {
          const headers = new Headers(cached.headers);
          headers.set('X-Zodiac-Build-Source', 'cache');
          return new Response(await cached.blob(), {
            status: cached.status,
            statusText: cached.statusText,
            headers
          });
        }
        throw error;
      })
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(async (cached) => {
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(cacheName);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch (error) {
        const fallback = await caches.match(appRoot);
        if (fallback && event.request.mode === 'navigate') return fallback;
        throw error;
      }
    })
  );
});
