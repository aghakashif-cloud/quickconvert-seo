const PAGE_CACHE = "quickconvert-pages-v2";
const STATIC_CACHE = "quickconvert-static-v2";
const ACTIVE_CACHES = [PAGE_CACHE, STATIC_CACHE];

const PRECACHE_STATIC_ASSETS = [
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
];

// Install: precache core static icons/manifest and activate immediately
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_STATIC_ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

// Activate: purge outdated caches and take control of open clients right away
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !ACTIVE_CACHES.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isHtmlOrNavigationRequest(request, url) {
  if (request.mode === "navigate") return true;
  if (request.destination === "document") return true;
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    return true;
  }
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function isStaticAssetRequest(request, url) {
  const dest = request.destination;
  if (dest === "style" || dest === "image" || dest === "font") {
    return true;
  }

  const pathname = url.pathname;
  if (
    pathname.startsWith("/_next/static/css/") ||
    pathname.startsWith("/_next/static/media/") ||
    pathname.startsWith("/icons/")
  ) {
    return true;
  }

  return /\.(?:css|png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?|ttf|otf)$/i.test(
    pathname
  );
}

// Network First strategy for HTML pages & navigations so users always see latest deploys
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetch(request);
    if (
      networkResponse &&
      networkResponse.status === 200 &&
      networkResponse.type === "basic"
    ) {
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    if (request.mode === "navigate") {
      const fallbackHome = await cache.match("/");
      if (fallbackHome) return fallbackHome;
    }

    return new Response("Offline — please reconnect to load this page.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

// Cache First strategy for static assets (images, CSS, fonts)
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);
  if (
    networkResponse &&
    networkResponse.status === 200 &&
    networkResponse.type === "basic"
  ) {
    cache.put(request, networkResponse.clone()).catch(() => {});
  }
  return networkResponse;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip cross-origin requests (AdSense, GTM, HuggingFace models, FFmpeg CDN, etc.)
  if (url.origin !== self.location.origin) return;

  // Never cache API endpoints, local AI model weights, or the service worker script itself
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/models/") ||
    url.pathname.startsWith("/background-removal/") ||
    url.pathname === "/sw.js"
  ) {
    return;
  }

  // 1. HTML pages & App Router navigations -> Network First
  if (isHtmlOrNavigationRequest(request, url)) {
    event.respondWith(networkFirst(request, PAGE_CACHE));
    return;
  }

  // 2. Static assets (images, CSS, fonts) -> Cache First
  if (isStaticAssetRequest(request, url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 3. Other same-origin requests (JS bundles, workers) -> Network First to avoid stale app code
  event.respondWith(networkFirst(request, PAGE_CACHE));
});
