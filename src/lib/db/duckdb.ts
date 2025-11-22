import { browser } from "$app/environment";
import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import * as duckdb from "@duckdb/duckdb-wasm";
import { downloadParquetFile, runMigration, runFTSIndexing, resetFTSState } from "./repository";

const CDN_BASE = "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.31.0/dist";
const OPFS_DB_PATH = "opfs://monocuco.db";
const DB_VERSION_KEY = "monocuco_db_version";

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: `${CDN_BASE}/duckdb-mvp.wasm`,
    mainWorker: "/duckdb-browser-mvp.worker.min.js",
  },
  eh: {
    mainModule: `${CDN_BASE}/duckdb-eh.wasm`,
    mainWorker: "/duckdb-browser-eh.worker.min.js",
  },
};

const DUCKDB_T0 = performance.now();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function performanceLog(...msg: any[]) {
  const elapsed = (performance.now() - DUCKDB_T0).toFixed(1);
  console.log(`[DuckDB] +${elapsed}ms ${msg}`);
}

let connectionPromise: Promise<AsyncDuckDBConnection> | null = null;

function isOpfsSupported(): boolean {
  if (!browser) return false;

  const hasNavigator = "navigator" in globalThis;
  const hasStorage = hasNavigator && "storage" in navigator;
  const hasGetDirectory = hasStorage && "getDirectory" in navigator.storage;

  return hasNavigator && hasStorage && hasGetDirectory;
}

async function getCurrentDataVersion(): Promise<string | null> {
  try {
    // Service worker handles caching with stale-while-revalidate
    // This allows offline support while keeping data fresh when online
    const response = await fetch("/data.parquet.json");
    if (!response.ok) return null;

    const metadata = await response.json();
    return metadata?.hash ?? metadata?.version ?? metadata?.createdAt ?? null;
  } catch (error) {
    console.warn("[DuckDB] Could not fetch data version (offline?):", error);
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
    performanceLog("[DuckDB] Stored database version:", version);
  } catch (error) {
    console.warn("[DuckDB] Could not store database version:", error);
  }
}

async function needsMigration(): Promise<{ needed: boolean; currentVersion: string | null }> {
  const currentVersion = await getCurrentDataVersion();
  const storedVersion = getStoredDbVersion();

  performanceLog("[DuckDB] Version check:", { currentVersion, storedVersion });

  // If we can't determine versions, run migrations to be safe
  if (!currentVersion) {
    return { needed: true, currentVersion };
  }

  // If versions don't match or no stored version, migrations needed
  const needed = currentVersion !== storedVersion;
  performanceLog("[DuckDB] Migrations needed:", needed);

  return { needed, currentVersion };
}

async function openDatabase(): Promise<{ db: AsyncDuckDB; usingOpfs: boolean }> {
  performanceLog("[DuckDB] Loading bundle");

  const logger = new duckdb.ConsoleLogger();
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
  const worker = new Worker(bundle.mainWorker!);

  performanceLog("[DuckDB] Instantiate worker");

  const db = new duckdb.AsyncDuckDB(logger, worker);

  await db.instantiate(bundle.mainModule, bundle.pthreadWorker ?? null);

  performanceLog("[DuckDB] Check OPFS supported");

  // Try to use OPFS for persistence, fallback to in-memory
  const opfsSupported = isOpfsSupported();
  let usingOpfs = false;

  try {
    if (opfsSupported) {
      performanceLog("[DuckDB] Opening OPFS database:", OPFS_DB_PATH);

      await db.open({
        path: OPFS_DB_PATH,
        accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
      });
      performanceLog("[DuckDB] OPFS database opened successfully");
      usingOpfs = true;
    } else {
      performanceLog("[DuckDB] OPFS not supported, using in-memory database");
      await db.open({ allowUnsignedExtensions: true });
    }

    // Since we only read data (no writes), we can use aggressive optimizations
    const conn = await db.connect();
    try {
      // Increase memory limit for better query performance (default is often too low)
      await conn.query("SET memory_limit='512MB'");
      // Increase threads for parallel query execution
      await conn.query("SET threads=4");
      // Enable query result caching for repeated queries
      await conn.query("SET enable_object_cache=true");
      // Disable write-related overhead (we're read-only after migration)
      await conn.query("SET wal_autocheckpoint='1GB'"); // Reduce checkpoint frequency
      // Optimize for analytical queries
      await conn.query("SET preserve_insertion_order=false");
      performanceLog("[DuckDB] Applied read-optimized configuration");
    } catch (configError) {
      console.warn("[DuckDB] Could not apply all optimizations:", configError);
    } finally {
      await conn.close();
    }
  } catch (error) {
    console.warn("[DuckDB] Failed to open OPFS database, falling back to in-memory:", error);
    await db.open({ allowUnsignedExtensions: true });
    usingOpfs = false;

    // Clear stored version since we can't use OPFS
    try {
      localStorage.removeItem(DB_VERSION_KEY);
      performanceLog("[DuckDB] Cleared stored version due to OPFS failure");
    } catch {
      // Ignore localStorage errors
    }
  }

  return { db, usingOpfs };
}

async function initialiseConnection(): Promise<AsyncDuckDBConnection> {
  if (!browser) {
    throw new Error("DuckDB is only available in the browser");
  }

  try {
    // Step 1: Check OPFS support and migrations FIRST (before opening database)
    const opfsSupported = isOpfsSupported();
    let shouldRunMigrations = false;
    let currentVersion: string | null = null;

    if (opfsSupported) {
      // Check if migrations are needed
      const { needed, currentVersion: version } = await needsMigration();
      shouldRunMigrations = needed;
      currentVersion = version;

      if (needed) {
        performanceLog("[DuckDB] Migrations needed for version:", currentVersion);
      } else {
        performanceLog("[DuckDB] Database is up-to-date, will load from OPFS");
      }
    } else {
      // Always run migrations for in-memory fallback
      shouldRunMigrations = true;
      const { currentVersion: version } = await needsMigration();
      currentVersion = version;

      performanceLog("[DuckDB] OPFS not supported, will use in-memory with migrations");
    }

    // Step 2: Open database
    const { db, usingOpfs } = await openDatabase();

    const connection = await db.connect();

    // Step 3: Run migrations if needed
    if (shouldRunMigrations) {
      // Download parquet file and register it
      const parquetFile = await downloadParquetFile();
      await db.registerFileBuffer(parquetFile.name, parquetFile.buffer);

      // Run migrations (create tables, basic indexes - fast)
      await runMigration(connection);

      if (usingOpfs) {
        // CRITICAL: Flush data to OPFS for persistence
        await connection.query("CHECKPOINT");
        performanceLog("[DuckDB] Database checkpointed to OPFS");

        // Store the version after successful migration
        if (currentVersion) {
          storeDbVersion(currentVersion);
        }
      } else {
        performanceLog("[DuckDB] In-memory database ready (no persistence)");
      }

      // Start FTS indexing in background (non-blocking)
      runFTSIndexing(connection)
        .then(() => {
          performanceLog("[DuckDB] FTS indexing completed in background");
          if (usingOpfs) {
            // Checkpoint FTS index to OPFS for persistence
            connection
              .query("CHECKPOINT")
              .then(() => {
                performanceLog("[DuckDB] FTS index checkpointed to OPFS");
              })
              .catch((err) => {
                console.error("[DuckDB] Failed to checkpoint FTS index:", err);
              });
          }
        })
        .catch((err) => {
          console.error("[DuckDB] FTS indexing failed:", err);
        });
    } else {
      performanceLog("[DuckDB] Loaded from OPFS, skipping migrations");
      // FTS should already be indexed if loaded from OPFS, verify and mark ready
      runFTSIndexing(connection, true).catch((err) => {
        console.error("[DuckDB] FTS verification failed:", err);
      });
    }

    return connection;
  } catch (error) {
    console.error("[DuckDB] Failed to initialize database:", error);
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
  resetFTSState();
}
