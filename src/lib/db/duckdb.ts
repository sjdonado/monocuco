import { browser } from '$app/environment';
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import * as duckdb from '@duckdb/duckdb-wasm';
import { runWordsMigration } from './words';
import { migrationProgress } from './migration-progress';

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

const DB_NAME = 'monocuco.db';
const OPFS_PARQUET_NAME = 'opfs://data.parquet';

let connectionPromise: Promise<AsyncDuckDBConnection> | null = null;

async function verifyDatabaseTables(connection: AsyncDuckDBConnection): Promise<boolean> {
	try {
		await connection.query('SELECT COUNT(*) FROM words LIMIT 1');
		return true;
	} catch {
		return false;
	}
}

async function openDatabase(): Promise<AsyncDuckDB> {
	const logger = new duckdb.ConsoleLogger();
	const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
	const worker = new Worker(bundle.mainWorker!);

	const db = new duckdb.AsyncDuckDB(logger, worker);
	await db.instantiate(bundle.mainModule, bundle.pthreadWorker ?? null);

	// Try to open with OPFS persistence
	try {
		await db.open({
			allowUnsignedExtensions: true,
			path: DB_NAME,
		});
		console.log('✅ Opened database with OPFS persistence');
	} catch (error) {
		console.warn('Failed to open with OPFS, using in-memory:', error);
		// Fallback to in-memory
		await db.open({
			allowUnsignedExtensions: true
		});
		console.log('Opened in-memory database (no persistence)');
	}

	return db;
}

async function initialiseConnection(): Promise<AsyncDuckDBConnection> {
	if (!browser) {
		throw new Error('DuckDB is only available in the browser');
	}

	try {
		// Open database
		const db = await openDatabase();
		const connection = await db.connect();

		// Check if tables already exist (database persisted from previous session)
		const tablesExist = await verifyDatabaseTables(connection);

		if (tablesExist) {
			console.log('✅ Database loaded from OPFS - tables already exist!');

			// No progress needed
			migrationProgress.set({
				isRunning: false,
				stage: 'complete',
				percentage: 100,
				message: 'Base de datos cargada'
			});
		} else {
			console.warn('First load or tables missing - running migration...');

			// Show progress
			migrationProgress.set({
				isRunning: true,
				stage: 'downloading',
				percentage: 0,
				message: 'Inicializando base de datos...'
			});

			// Run migration (will cache parquet to OPFS)
			await runWordsMigration(connection, db, OPFS_PARQUET_NAME);

			// Flush database to OPFS to persist tables and indexes
			await db.flushFiles();
			console.log('Database flushed to OPFS');

			console.log('✅ Migration completed - database will persist for next load');
		}

		return connection;
	} catch (error) {
		if (migrationProgress.set) {
			migrationProgress.set({
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
