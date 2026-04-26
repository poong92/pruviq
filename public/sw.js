/**
 * sw.js — PRUVIQ service worker (W4-3b).
 *
 * Conservative caching strategy designed to never lock users into stale
 * application state. Specifically:
 *
 *   - HTML navigation requests:    NETWORK-ONLY (no cache, no fallback)
 *   - JSON data (/data/*.json):    NETWORK-ONLY (always fresh)
 *   - Dynamic OG (/og/*.png):      NETWORK-ONLY (refreshes nightly)
 *   - JS bundles (/_astro/*):      NETWORK-FIRST with cache fallback
 *                                  (Astro hashes filenames; old assets
 *                                  in cache are safe to serve if
 *                                  network is down — they match the
 *                                  HTML's hash references.)
 *   - Static long-lived assets:    CACHE-FIRST with network fallback
 *     (favicon, fonts, og-image.{jpg,png,webp,avif,svg})
 *
 * The "no HTML caching" rule is the load-bearing safety property. Any
 * deploy with breaking changes will be picked up immediately on the next
 * navigation. There is no way for this SW to leave a user stuck on an
 * old version of the app.
 *
 * Versioning:
 *   CACHE_NAME bumps on every meaningful change to this file. On
 *   activate, all caches that don't match the current name are deleted
 *   so users get a clean state on the next install. Bumping the version
 *   is the unregister-and-reset mechanism — no need to ship a separate
 *   unregister page in this iteration.
 *
 * Disable path:
 *   Set EMERGENCY_DISABLE = true (next line) and ship. The SW will
 *   immediately bypass cache for everything and uninstall itself on
 *   the next page load.
 */

const CACHE_NAME = "pruviq-static-v1";
const EMERGENCY_DISABLE = false;

// Static assets that are safe to cache aggressively. Astro fingerprints
// /_astro/* filenames so we use a separate cache strategy for those
// rather than including them here.
const PRECACHE_URLS = [
  "/favicon.svg",
  "/og-image.jpg",
];

// File extension matchers for the cache-first long-lived strategy.
const STATIC_EXT_RE = /\.(woff2?|ttf|otf|svg|ico|png|jpe?g|webp|avif)$/i;
const ASTRO_HASHED_RE = /^\/_astro\//;

self.addEventListener("install", (event) => {
  if (EMERGENCY_DISABLE) {
    return;
  }
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((url) => cache.add(url).catch(() => {})),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  if (EMERGENCY_DISABLE) {
    event.waitUntil(
      // Self-unregister: delete every cache + tell the browser to drop
      // this SW so the next page load runs without us in the loop.
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.claim()),
    );
    return;
  }

  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isHtmlNavigation(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function isJsonData(url) {
  return url.pathname.startsWith("/data/") && url.pathname.endsWith(".json");
}

function isOgImage(url) {
  return url.pathname.startsWith("/og/") && url.pathname.endsWith(".png");
}

self.addEventListener("fetch", (event) => {
  if (EMERGENCY_DISABLE) {
    return;
  }

  const request = event.request;

  // Only intercept GET. Other methods pass through untouched.
  if (request.method !== "GET") return;

  // Only intercept same-origin requests. Cross-origin (CDN images,
  // CoinGecko, Cloudflare Insights, etc.) bypass the SW entirely.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // HTML navigation: network-only. Never serve a cached HTML page.
  if (isHtmlNavigation(request)) {
    return;
  }

  // JSON data + dynamic OG: network-only.
  if (isJsonData(url) || isOgImage(url)) {
    return;
  }

  // Astro-hashed assets: network-first with cache fallback.
  if (ASTRO_HASHED_RE.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses for offline fallback.
          if (response.ok && response.type === "basic") {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Static long-lived assets: cache-first.
  if (STATIC_EXT_RE.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Everything else: passthrough.
});
