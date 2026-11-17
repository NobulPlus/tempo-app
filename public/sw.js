// Tempo service worker — exists only to satisfy PWA installability and
// speed up repeat loads of immutable static assets. It never caches pages,
// API routes, or server actions: this app is a live booking/payments
// marketplace, so serving stale HTML or stale data would be actively
// harmful. Bump CACHE_VERSION to invalidate old caches on deploy.
const CACHE_VERSION = "tempo-static-v1";

const CACHEABLE_PATH_PREFIXES = ["/_next/static/", "/icons/"];

function isCacheable(url) {
  if (url.origin !== self.location.origin) return false;
  return CACHEABLE_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isCacheable(url)) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    }),
  );
});
