/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, prerendered, version } from "$service-worker";

declare const self: ServiceWorkerGlobalScope;

const ASSET_CACHE = `asset-cache-${version}`;
// The search data (1.5 MB) is not precached: the page loads it on first use, and the worker
// keeps it from then on, so a reader never downloads it and search works offline after one
// search online.
const SEARCH_DATA = new Set(["/data.json", "/search-index.json"]);
// Pre-cache static assets (JS, CSS, etc.)
const PRECACHE = new Set([...build, ...files, ...prerendered].filter((f) => !SEARCH_DATA.has(f)));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(ASSET_CACHE)
      // The home page is rendered by the server, so it is not in `prerendered`; cache it too.
      .then((cache) => cache.addAll([...PRECACHE, "/"]))
      .catch((error) => {
        console.error("SW install failed", error);
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== ASSET_CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event: FetchEvent) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cache-first for precached assets (JS, CSS, etc.)
  if (url.origin === self.location.origin && SEARCH_DATA.has(url.pathname)) {
    event.respondWith(searchData(request));
    return;
  }

  if (url.origin === self.location.origin && PRECACHE.has(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Network-first with cache fallback for same-origin requests
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirstWithCacheFallback(request));
    return;
  }
});

// The words and the index are cached together or not at all, so a failed or partial fetch can
// never pair one version of the words with another version of the index.
// The page asks for both at once: one fetch of the pair serves both requests.
let pendingSearchData: Promise<Response[]> | null = null;

async function searchData(request: Request): Promise<Response> {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const paths = [...SEARCH_DATA];
  pendingSearchData ??= (async () => {
    try {
      const responses = await Promise.all(paths.map((path) => fetch(path)));
      if (responses.every((r) => r.ok)) {
        await Promise.all(paths.map((path, i) => cache.put(path, responses[i].clone())));
      }
      return responses;
    } finally {
      pendingSearchData = null;
    }
  })();
  const responses = await pendingSearchData;
  return responses[paths.indexOf(new URL(request.url).pathname)].clone();
}

async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const resp = await fetch(request);
  if (resp.ok && new URL(request.url).origin === self.location.origin) {
    await cache.put(request, resp.clone());
  }
  return resp;
}

async function networkFirstWithCacheFallback(request: Request): Promise<Response> {
  const cache = await caches.open(ASSET_CACHE);
  try {
    const resp = await fetch(request);
    if (resp.ok && new URL(request.url).origin === self.location.origin) {
      await cache.put(request, resp.clone());
    }
    return resp;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Offline, any state of the home page opens from the cached home page; a word, letter or
    // search then needs the search data, cached once the visitor has searched online.
    const url = new URL(request.url);
    if (request.mode === "navigate" && url.pathname === "/") {
      // Every / response varies on Accept; the cached home matches any navigation.
      const home = await cache.match("/", { ignoreVary: true });
      if (home) return home;
    }
    throw new Error("Network error and no cached response available");
  }
}
