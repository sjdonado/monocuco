import { browser } from '$app/environment';
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import * as duckdb from '@duckdb/duckdb-wasm';
import { downloadParquetFile, runMigration } from './repository';
import { splashScreenProgress } from './splash-screen-progress';

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
	mvp: {
		mainModule: '/duckdb-mvp.wasm',
		mainWorker: '/duckdb-browser-mvp.worker.min.js'
	},
	eh: {
		mainModule: '/duckdb-eh.wasm',
		mainWorker: '/duckdb-browser-eh.worker.min.js'
	}
};

let connectionPromise: Promise<AsyncDuckDBConnection> | null = null;

async function openDatabase(): Promise<AsyncDuckDB> {
	splashScreenProgress.set({
		isRunning: true,
		stage: 'init',
		percentage: 5,
		message: 'Inicializando base de datos...'
	});

	const logger = new duckdb.ConsoleLogger();
	const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
	const worker = new Worker(bundle.mainWorker!);

	splashScreenProgress.set({
		isRunning: true,
		stage: 'init',
		percentage: 10,
		message: 'Configurando base de datos en el navegador...'
	});

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
		const [{ db, connection }, parquetFile] = await Promise.all([
			(async () => {
				const db = await openDatabase();
				const connection = await db.connect();
				return { db, connection }
			})(),
			downloadParquetFile()
		])

		splashScreenProgress.set({
			isRunning: true,
			stage: 'init',
			percentage: 20,
			message: 'Conneción creada...'
		});

		await db.registerFileBuffer(parquetFile.name, parquetFile.buffer);
		await runMigration(connection);

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
