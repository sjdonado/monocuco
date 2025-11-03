/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, prerendered, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const PARQUET_PATH = '/data.parquet';
const PARQUET_META_PATH = '/data.parquet.json';

const ASSET_CACHE = `asset-cache-${version}`;

// Pre-cache everything SvelteKit knows about EXCEPT the parquet + its metadata.
// (We want fine-grained invalidation for the parquet via the JSON manifest.)
const PRECACHE = new Set(
	[...build, ...files, ...prerendered].filter((p) => p !== PARQUET_PATH && p !== PARQUET_META_PATH)
);

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

	// 1) Parquet with metadata-driven invalidation
	if (url.origin === self.location.origin && url.pathname === PARQUET_PATH) {
		event.respondWith(handleParquetRequest(request));
		return;
	}

	// 2) Keep the metadata JSON network-first (but cached for offline)
	if (url.origin === self.location.origin && url.pathname === PARQUET_META_PATH) {
		event.respondWith(networkFirstAndCache(request));
		return;
	}

	// 3) Cache-first for precached assets (includes duckdb worker scripts in /static)
	if (url.origin === self.location.origin && PRECACHE.has(url.pathname)) {
		event.respondWith(cacheFirst(request));
		return;
	}

	// 4) Default: network-first with cache fallback for same-origin,
	//    just passthrough for cross-origin.
	if (url.origin === self.location.origin) {
		event.respondWith(networkFirstWithCacheFallback(request));
		return;
	}
	// Cross-origin: try network; if it fails and we have a cached copy, return that.
	event.respondWith(networkFirstWithCacheFallback(request));
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

async function networkFirstAndCache(request: Request): Promise<Response> {
	const cache = await caches.open(ASSET_CACHE);
	try {
		const resp = await fetch(request, { cache: 'no-store' });
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
 * For /data.parquet:
 * - Fetch /data.parquet.json (no-store) to get the latest manifest.
 * - Compare its "hash" (or "version"/"createdAt") with the cached manifest.
 * - If changed or missing, refetch /data.parquet (no-store) and update the cache.
 * - Otherwise, serve the cached parquet (or fetch & cache if it isn't cached yet).
 */
async function handleParquetRequest(request: Request): Promise<Response> {
	const cache = await caches.open(ASSET_CACHE);
	const metaUrl = new URL(PARQUET_META_PATH, self.location.origin).toString();

	// Try network for the manifest to detect updates
	let freshHash: string | null = null;
	try {
		const freshMetaResp = await fetch(metaUrl, { cache: 'no-store' });
		if (freshMetaResp.ok) {
			await cache.put(PARQUET_META_PATH, freshMetaResp.clone());
			const freshMeta = await freshMetaResp.clone().json();
			freshHash = freshMeta?.hash ?? freshMeta?.version ?? freshMeta?.createdAt ?? null;
		}
	} catch {
		// Offline: we'll fall back to cached manifest below
	}

	// Read cached manifest (if any)
	let cachedHash: string | null = null;
	const cachedMetaResp = await cache.match(PARQUET_META_PATH);
	if (cachedMetaResp) {
		try {
			const cachedMeta = await cachedMetaResp.clone().json();
			cachedHash = cachedMeta?.hash ?? cachedMeta?.version ?? cachedMeta?.createdAt ?? null;
		} catch {
			cachedHash = null;
		}
	}

	// If we have a fresh manifest and it differs from cached, refresh parquet
	if (freshHash && freshHash !== cachedHash) {
		try {
			const freshParquet = await fetch(request, { cache: 'no-store' });
			if (freshParquet.ok) {
				await cache.put(request, freshParquet.clone());
				return freshParquet;
			}
		} catch {
			// If network fails, fall back to whatever we have cached below
		}
	}

	// Otherwise, serve cached parquet if present; fall back to network if not.
	const cachedParquet = await cache.match(request);
	if (cachedParquet) return cachedParquet;

	const networkParquet = await fetch(request);
	if (networkParquet.ok) {
		await cache.put(request, networkParquet.clone());
	}
	return networkParquet;
}
