/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, prerendered, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const ASSET_CACHE = `asset-cache-${version}`;

// Pre-cache static assets (JS, CSS, WASM workers, etc.)
// Note: data.parquet and data.parquet.json are NOT cached here because OPFS handles persistence and we check versions via localStorage
const PRECACHE = new Set([...build, ...files, ...prerendered]);

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(ASSET_CACHE)
			.then((cache) => cache.addAll(Array.from(PRECACHE)))
			.catch((error) => {
				console.error('SW install failed', error);
			})
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((k) => k !== ASSET_CACHE).map((k) => caches.delete(k)))
			)
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event: FetchEvent) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);

	// Cache-first for precached assets (JS, CSS, WASM workers, etc.)
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
		throw new Error('Network error and no cached response available');
	}
}
