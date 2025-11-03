import { browser } from '$app/environment';
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import * as duckdb from '@duckdb/duckdb-wasm';
import { downloadParquetFile, runMigration } from './repository';
import { splashScreenProgress } from './splash-screen-progress';

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.31.0/dist';
const OPFS_DB_PATH = 'opfs://monocuco.db';
const DB_VERSION_KEY = 'monocuco_db_version';

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

function isOpfsSupported(): boolean {
	if (!browser) return false;

	const hasNavigator = 'navigator' in globalThis;
	const hasStorage = hasNavigator && 'storage' in navigator;
	const hasGetDirectory = hasStorage && 'getDirectory' in navigator.storage;

	return hasNavigator && hasStorage && hasGetDirectory;
}

async function getCurrentDataVersion(): Promise<string | null> {
	try {
		const response = await fetch('/data.parquet.json', { cache: 'no-store' });
		if (!response.ok) return null;

		const metadata = await response.json();
		return metadata?.hash ?? metadata?.version ?? metadata?.createdAt ?? null;
	} catch (error) {
		console.warn('[DuckDB] Could not fetch data version:', error);
		return null;
	}
}

function getStoredDbVersion(): string | null {
	try {
		return localStorage.getItem(DB_VERSION_KEY);
	} catch {
		return null;
	}
}

function storeDbVersion(version: string): void {
	try {
		localStorage.setItem(DB_VERSION_KEY, version);
		console.log('[DuckDB] Stored database version:', version);
	} catch (error) {
		console.warn('[DuckDB] Could not store database version:', error);
	}
}

async function needsMigration(): Promise<{ needed: boolean; currentVersion: string | null }> {
	const currentVersion = await getCurrentDataVersion();
	const storedVersion = getStoredDbVersion();

	console.log('[DuckDB] Version check:', { currentVersion, storedVersion });

	// If we can't determine versions, run migrations to be safe
	if (!currentVersion) {
		return { needed: true, currentVersion };
	}

	// If versions don't match or no stored version, migrations needed
	const needed = currentVersion !== storedVersion;
	console.log('[DuckDB] Migrations needed:', needed);

	return { needed, currentVersion };
}

/**
 * Check if database is ready (OPFS database exists and is up-to-date).
 * Returns true if we can skip splash screen, false otherwise.
 */
async function isDatabaseReady(): Promise<boolean> {
	if (!browser) return false;

	// If OPFS is not supported, we'll always need to rebuild
	if (!isOpfsSupported()) {
		console.log('[DuckDB] OPFS not supported, will use in-memory database');
		return false;
	}

	// Check if migrations are needed
	const { needed } = await needsMigration();

	if (!needed) {
		console.log('[DuckDB] Database is up-to-date, skipping splash screen');
		return true;
	}

	console.log('[DuckDB] Database needs initialization, showing splash screen');
	return false;
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

	// Try to use OPFS for persistence, fallback to in-memory
	const useOpfs = isOpfsSupported();

	try {
		if (useOpfs) {
			console.log('[DuckDB] Opening OPFS database:', OPFS_DB_PATH);
			await db.open({
				path: OPFS_DB_PATH,
				accessMode: duckdb.DuckDBAccessMode.READ_WRITE
			});
			console.log('[DuckDB] OPFS database opened successfully');
		} else {
			console.log('[DuckDB] OPFS not supported, using in-memory database');
			await db.open({ allowUnsignedExtensions: true });
		}
	} catch (error) {
		console.warn('[DuckDB] Failed to open OPFS database, falling back to in-memory:', error);
		await db.open({ allowUnsignedExtensions: true });
	}

	return db;
}

async function initialiseConnection(): Promise<AsyncDuckDBConnection> {
	if (!browser) {
		throw new Error('DuckDB is only available in the browser');
	}

	const isReady = await isDatabaseReady();
	splashScreenProgress.update((state) => ({
		...state,
		enabled: !isReady
	}));

	try {
		const db = await openDatabase();
		const connection = await db.connect();

		splashScreenProgress.update((state) => ({
			...state,
			isRunning: true,
			stage: 'init',
			percentage: 20,
			message: 'Conexión creada...'
		}));

		const { needed: migrationsNeeded, currentVersion } = await needsMigration();

		if (migrationsNeeded) {
			console.log('[DuckDB] Running migrations for version:', currentVersion);

			// Download parquet file and register it
			const parquetFile = await downloadParquetFile();
			await db.registerFileBuffer(parquetFile.name, parquetFile.buffer);

			await runMigration(connection);

			// CRITICAL: Flush data to OPFS for persistence
			await connection.query('CHECKPOINT');
			console.log('[DuckDB] Database checkpointed to OPFS');

			// Store the version after successful migration
			if (currentVersion) {
				storeDbVersion(currentVersion);
			}
		} else {
			console.log('[DuckDB] Database is up-to-date, loading from OPFS');
			// No need to download or register parquet - data is already in OPFS tables
		}

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
