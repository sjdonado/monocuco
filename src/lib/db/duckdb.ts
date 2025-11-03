import { browser } from '$app/environment';
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import * as duckdb from '@duckdb/duckdb-wasm';
import { downloadParquetFile, runMigration } from './repository';
import { splashScreenProgress } from './splash-screen-progress';

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.31.0/dist';

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
	mvp: {
		mainModule: `${CDN_BASE}/duckdb-mvp.wasm`,
		mainWorker: '/duckdb-browser-mvp.worker.min.js'
	},
	eh: {
		mainModule: `${CDN_BASE}/duckdb-eh.wasm`,
		mainWorker: '/duckdb-browser-eh.worker.min.js'
	}
};

let connectionPromise: Promise<AsyncDuckDBConnection> | null = null;

/**
 * Check if data.parquet is already cached by the service worker.
 * Returns true if cached (subsequent load), false otherwise (first load).
 * We only check for data.parquet as it's the largest file and indicates
 * the database has been initialized before.
 */
async function isDataCached(): Promise<boolean> {
	if (!browser || !('caches' in window)) return false;

	try {
		// Wait a bit to ensure service worker has had time to activate
		await new Promise((resolve) => setTimeout(resolve, 50));

		const cacheNames = await caches.keys();
		for (const cacheName of cacheNames) {
			const cache = await caches.open(cacheName);
			const response = await cache.match('/data.parquet');
			if (response) {
				console.log('[DuckDB] Data cached, skipping splash screen');
				return true;
			}
		}

		console.log('[DuckDB] Data not cached, showing splash screen');
		return false;
	} catch (error) {
		console.error('[DuckDB] Cache check failed:', error);
		// If checking fails, assume not cached (show splash screen to be safe)
		return false;
	}
}

async function openDatabase(): Promise<AsyncDuckDB> {
	splashScreenProgress.update((state) => ({
		...state,
		isRunning: true,
		stage: 'init',
		percentage: 5,
		message: 'Inicializando base de datos...'
	}));

	const logger = new duckdb.ConsoleLogger();
	const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
	const worker = new Worker(bundle.mainWorker!);

	splashScreenProgress.update((state) => ({
		...state,
		isRunning: true,
		stage: 'init',
		percentage: 10,
		message: 'Configurando base de datos en el navegador...'
	}));

	const db = new duckdb.AsyncDuckDB(logger, worker);
	await db.instantiate(bundle.mainModule, bundle.pthreadWorker ?? null);

	await db.open({ allowUnsignedExtensions: true });
	return db;
}

async function initialiseConnection(): Promise<AsyncDuckDBConnection> {
	if (!browser) {
		throw new Error('DuckDB is only available in the browser');
	}

	// Check if data is cached and set the enabled flag accordingly
	const isCached = await isDataCached();
	splashScreenProgress.update((state) => ({
		...state,
		enabled: !isCached
	}));

	try {
		const [{ db, connection }, parquetFile] = await Promise.all([
			(async () => {
				const db = await openDatabase();
				const connection = await db.connect();
				return { db, connection };
			})(),
			downloadParquetFile()
		]);

		splashScreenProgress.update((state) => ({
			...state,
			isRunning: true,
			stage: 'init',
			percentage: 20,
			message: 'Conneción creada...'
		}));

		await db.registerFileBuffer(parquetFile.name, parquetFile.buffer);
		await runMigration(connection);

		return connection;
	} catch (error) {
		splashScreenProgress.update((state) => ({
			...state,
			isRunning: false,
			stage: 'idle',
			percentage: 0,
			message: 'Error al inicializar la base de datos'
		}));
		throw error;
	}
}

export async function getConnection(): Promise<AsyncDuckDBConnection> {
	if (!connectionPromise) {
		connectionPromise = initialiseConnection();
	}
	return connectionPromise;
}

export function resetConnection(): void {
	connectionPromise = null;
}
