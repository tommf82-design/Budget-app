const CACHE_NAME = "carnet-cache-v4";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./vendor/react.production.min.js",
  "./vendor/react-dom.production.min.js",
  "./vendor/babel.min.js",
  "./vendor/xlsx.full.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Cache-first for everything (app shell + CDN scripts + fonts), so the app
// keeps working offline once it has been opened at least once with network.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // GitHub API responses (and anything else dynamic/cross-origin) must never be
  // cached: sync depends on always reading the current file "sha" from GitHub.
  if (url.hostname === "api.github.com" || url.hostname === "raw.githubusercontent.com") {
    event.respondWith(fetch(event.request));
    return;
  }

  // The app's own HTML: always try the network first so updates show up on the
  // very next load, falling back to the cached copy only when offline.
  const isAppShell = url.origin === self.location.origin && (event.request.mode === "navigate" || url.pathname.endsWith("index.html") || url.pathname.endsWith("/"));
  if (isAppShell) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else (vendored libraries, icons, manifest): cache-first for speed
  // and true offline support, since these rarely change.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
