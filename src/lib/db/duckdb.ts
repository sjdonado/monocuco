import { browser } from '$app/environment';
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import * as duckdb from '@duckdb/duckdb-wasm';
import { runWordsMigration } from './words';

// Manual bundle configuration: workers from same origin, WASM from CDN
const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.31.0/dist';

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
	mvp: {
		mainModule: `${CDN_BASE}/duckdb-mvp.wasm`,
		mainWorker: '/duckdb-browser-mvp.worker.js'
	},
	eh: {
		mainModule: `${CDN_BASE}/duckdb-eh.wasm`,
		mainWorker: '/duckdb-browser-eh.worker.js'
	}
};

let connectionPromise: Promise<AsyncDuckDBConnection> | null = null;

async function initialiseConnection(): Promise<AsyncDuckDBConnection> {
	if (!browser) {
		throw new Error('DuckDB is only available in the browser');
	}

	const logger = new duckdb.ConsoleLogger();
	const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
	const worker = new Worker(bundle.mainWorker!);

	const db = new duckdb.AsyncDuckDB(logger, worker);
	await db.instantiate(bundle.mainModule, bundle.pthreadWorker ?? null);
	await db.open({
		allowUnsignedExtensions: true
	});

	const connection = await db.connect();
	await runWordsMigration(connection, db);

	return connection;
}

export async function getConnection(): Promise<AsyncDuckDBConnection> {
	if (!connectionPromise) {
		connectionPromise = initialiseConnection();
	}

	return connectionPromise;
}
