import { browser } from '$app/environment';
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import * as duckdb from '@duckdb/duckdb-wasm';
import { runWordsMigration } from './words';
import { splashScreenProgress } from './splash-screen-progress';

// Manual bundle configuration: workers from same origin, WASM from CDN
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

async function openDatabase(): Promise<AsyncDuckDB> {
	const logger = new duckdb.ConsoleLogger();
	const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
	const worker = new Worker(bundle.mainWorker!);

	const db = new duckdb.AsyncDuckDB(logger, worker);
	await db.instantiate(bundle.mainModule, bundle.pthreadWorker ?? null);

	await db.open({ allowUnsignedExtensions: true });
	return db;
}

async function initialiseConnection(): Promise<AsyncDuckDBConnection> {
	if (!browser) {
		throw new Error('DuckDB is only available in the browser');
	}

	try {
		const db = await openDatabase();
		const connection = await db.connect();

		splashScreenProgress.set({
			isRunning: true,
			stage: 'downloading',
			percentage: 0,
			message: 'Inicializando base de datos...'
		});

		await runWordsMigration(connection, db);

		return connection;
	} catch (error) {
		if (splashScreenProgress.set) {
			splashScreenProgress.set({
				isRunning: false,
				stage: 'idle',
				percentage: 0,
				message: 'Error al inicializar la base de datos'
			});
		}
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
