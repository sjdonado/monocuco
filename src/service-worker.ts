/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, prerendered, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const ASSET_CACHE = `asset-cache-${version}`;
const DATA_META_PATH = '/data.parquet.json';

// Pre-cache static assets (JS, CSS, WASM workers, etc.)
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

	// Special handling for data.parquet.json - stale-while-revalidate for offline support
	if (url.origin === self.location.origin && url.pathname === DATA_META_PATH) {
		event.respondWith(staleWhileRevalidate(request));
		return;
	}

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

/**
 * Stale-while-revalidate strategy for data.parquet.json
 * - Serves from cache immediately if available (instant offline support)
 * - Updates cache in background from network
 * - Falls back to network if no cache available
 */
async function staleWhileRevalidate(request: Request): Promise<Response> {
	const cache = await caches.open(ASSET_CACHE);
	const cached = await cache.match(request);

	// Fetch from network in the background and update cache
	const fetchPromise = fetch(request)
		.then((resp) => {
			if (resp.ok) {
				cache.put(request, resp.clone());
			}
			return resp;
		})
		.catch(() => null);

	// Return cached response immediately if available
	if (cached) {
		return cached;
	}

	// If no cache, wait for network
	const networkResp = await fetchPromise;
	if (networkResp) {
		return networkResp;
	}

	throw new Error('Network error and no cached metadata available');
}
