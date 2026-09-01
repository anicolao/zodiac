/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const worker = globalThis as unknown as ServiceWorkerGlobalScope;
const cacheName = `zodiac-${version}`;
const appRoot = new URL('./', worker.location.href).pathname;
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

worker.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== worker.location.origin) return;
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
