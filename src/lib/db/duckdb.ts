import { browser } from '$app/environment';
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { AsyncDuckDB, ConsoleLogger, selectBundle } from '@duckdb/duckdb-wasm';
import duckdbWasmEH from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import duckdbWorkerEH from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?worker';
import duckdbWasmMVP from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import duckdbWorkerMVP from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?worker';
import { runWordsMigration } from './words';

type WorkerConstructor = new () => Worker;

let connectionPromise: Promise<AsyncDuckDBConnection> | null = null;

async function initialiseConnection(): Promise<AsyncDuckDBConnection> {
	if (!browser) {
		throw new Error('DuckDB is only available in the browser');
	}

	const logger = new ConsoleLogger();
	const bundle = await selectBundle({
		mvp: {
			mainModule: duckdbWasmMVP,
			mainWorker: duckdbWorkerMVP
		},
		eh: {
			mainModule: duckdbWasmEH,
			mainWorker: duckdbWorkerEH
		}
	});
	const worker = bundle.mainWorker
		? new (bundle.mainWorker as unknown as WorkerConstructor)()
		: undefined;

	const db = new AsyncDuckDB(logger, worker ?? null);
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
