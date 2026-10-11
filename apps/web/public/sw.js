// Cupid Mail Service Worker
const CACHE_NAME = "cupid-mail-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/offline.html",
  "/assets/Logo.png",
  "/assets/Img.jpg",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/favicon.png"
];

// Install: Cache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn("[SW] Some assets failed to precache:", err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: Strategy depending on request type
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Only handle GET requests
  if (req.method !== "GET") {
    return;
  }

  // 2. Ignore non-http/https (e.g., chrome-extension://)
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // 3. API endpoints: Network-first, return JSON error if offline
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(
          JSON.stringify({
            error: "You are currently offline. Please check your internet connection.",
            offline: true
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" }
          }
        );
      })
    );
    return;
  }

  // 4. Navigation (HTML Pages): Network-first with cache/offline fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(req);
          if (cachedResponse) return cachedResponse;
          const offlinePage = await caches.match(OFFLINE_URL);
          if (offlinePage) return offlinePage;
          return caches.match("/");
        })
    );
    return;
  }

  // 5. Static Assets (images, fonts, scripts, css): Cache-first with network fallback
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".ttf") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          // Fetch in background to update cache (stale-while-revalidate)
          fetch(req)
            .then((fresh) => {
              if (fresh && fresh.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(req, fresh));
              }
            })
            .catch(() => {});
          return cached;
        }

        return fetch(req)
          .then((fresh) => {
            if (fresh && fresh.status === 200) {
              const clone = fresh.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return fresh;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // 6. Default: Network-first, fallback to cache
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
