import { browser } from '$app/environment';
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import * as duckdb from '@duckdb/duckdb-wasm';
import { runWordsMigration } from './words';

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

let connectionPromise: Promise<AsyncDuckDBConnection> | null = null;

async function initialiseConnection(): Promise<AsyncDuckDBConnection> {
	if (!browser) {
		throw new Error('DuckDB is only available in the browser');
	}

	const logger = new duckdb.ConsoleLogger();
	const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

	// Fetch worker script and create a blob URL to avoid CORS issues
	const workerResponse = await fetch(bundle.mainWorker!);
	const workerBlob = await workerResponse.blob();
	const workerUrl = URL.createObjectURL(workerBlob);
	const worker = new Worker(workerUrl);

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
