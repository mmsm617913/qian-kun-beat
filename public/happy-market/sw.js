const CACHE_NAME = "happy-market-github-offline-v1";
const BASE = self.registration.scope;
const asset = (path) => new URL(path, BASE).href;
const CORE_ASSETS = [
  "./",
  "./manifest.webmanifest",
  "./app-icon-192.png",
  "./app-icon-512.png",
  "./apple-touch-icon.png",
  "./favicon.svg",
  "./characters/yue-celebrate.png",
  "./characters/yue-love.jpeg",
  "./characters/yue-thinking.png",
  "./characters/yue-ok.jpeg",
  "./characters/yue-strong.jpeg",
].map(asset);

async function cachePageShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(CORE_ASSETS);
  const pageUrl = asset("./");

  try {
    const response = await fetch(new Request(pageUrl, { cache: "reload" }));
    if (!response.ok) return;
    await cache.put(pageUrl, response.clone());
    const html = await response.text();
    const discovered = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => new URL(match[1], pageUrl).href)
      .filter((url) => url.startsWith(BASE) && url !== asset("./sw.js"));
    await Promise.allSettled([...new Set(discovered)].map((url) => cache.add(url)));
  } catch {
    // 核心檔案仍可供離線開啟。
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(cachePageShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.url === asset("./sw.js")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(asset("./"), response.clone()));
          return response;
        })
        .catch(() => caches.match(asset("./"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    })),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
