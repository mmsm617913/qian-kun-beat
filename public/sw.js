const CACHE_NAME = 'qian-kun-beat-offline-v1';

const scopeRoot = new URL('./', self.registration.scope);
const coreAssets = [
  scopeRoot.href,
  new URL('manifest.webmanifest', scopeRoot).href,
  new URL('favicon.svg', scopeRoot).href,
  new URL('icon-192.png', scopeRoot).href,
  new URL('icon-512.png', scopeRoot).href,
  new URL('hand-sprites.png', scopeRoot).href,
];

async function fetchAndCache(cache, url) {
  const response = await fetch(url, { cache: 'reload' });
  if (!response.ok) throw new Error(`Unable to cache ${url}`);
  await cache.put(url, response.clone());
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const mainResponse = await fetchAndCache(cache, scopeRoot.href);
    const html = await mainResponse.clone().text();
    const discoveredAssets = new Set(coreAssets.slice(1));

    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      const assetUrl = new URL(match[1], scopeRoot);
      if (assetUrl.origin === self.location.origin) discoveredAssets.add(assetUrl.href);
    }

    await Promise.all([...discoveredAssets].map((url) => fetchAndCache(cache, url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match(scopeRoot.href));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});

