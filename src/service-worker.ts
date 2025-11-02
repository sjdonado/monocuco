/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, prerendered, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const ASSET_CACHE = `asset-cache-${version}`;
const ASSETS = new Set([...build, ...files, ...prerendered]);

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(ASSET_CACHE).then((cache) => cache.addAll(Array.from(ASSETS))).catch((error) => {
			console.error('SW install failed', error);
		})
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys
					.filter((key) => key !== ASSET_CACHE)
					.map((key) => caches.delete(key))
			)
		)
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event: FetchEvent) => {
	const { request } = event;

	if (request.method !== 'GET') {
		return;
	}

	const url = new URL(request.url);

	// Serve known build/static assets from cache first
	if (url.origin === self.location.origin && ASSETS.has(url.pathname)) {
		event.respondWith(
			caches.match(request).then((cached) => cached ?? fetch(request))
		);
		return;
	}

	// Network first for everything else, with cache fallback
	event.respondWith(
		caches.open(ASSET_CACHE).then(async (cache) => {
			try {
				const response = await fetch(request);
				if (url.origin === self.location.origin) {
					cache.put(request, response.clone());
				}
				return response;
			} catch (error) {
				const cached = await cache.match(request);
				if (cached) {
					return cached;
				}
				throw error;
			}
		})
	);
});
