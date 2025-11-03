import type { AsyncDuckDB, AsyncDuckDBConnection, AsyncPreparedStatement } from '@duckdb/duckdb-wasm';
import type { Table } from 'apache-arrow';
import { getConnection } from './duckdb';
import { migrationProgress } from './migration-progress';

const DATA_FILE_NAME = 'data.parquet';
const WORDS_TABLE = 'words';
const DEFAULT_PAGE_SIZE = 12;

interface WordParquetRow {
  id: string;
  word: string;
  definition: string;
  example: string;
  createdByName: string;
  createdByWebsite: string | null;
  createdAt: string;
}

export interface Word {
  id: string;
  word: string;
  definition: string;
  example: string;
  createdBy: {
    name: string;
    website: string | null;
  };
  createdAt: string;
}

export type WordSuggestion = Pick<Word, 'id' | 'word' | 'definition'>;

export const runWordsMigration = async (
  connection: AsyncDuckDBConnection,
  db: AsyncDuckDB,
  opfsFileName: string = 'opfs://data.parquet'
) => {
  let parquetPath = DATA_FILE_NAME;

  // Register OPFS file name
  try {
    await db.registerOPFSFileName(opfsFileName);

    // Wait for OPFS registration (required for reliable access)
    await new Promise((res) => setTimeout(() => res(), 1));
  } catch (error) {
    console.warn('Could not register OPFS file:', error);
  }

  // Try to load parquet from OPFS first
  let loadedFromOPFS = false;
  try {
    migrationProgress.set({
      isRunning: true,
      stage: 'downloading',
      percentage: 5,
      message: 'Verificando caché...'
    });

    // Test if parquet exists in OPFS
    await connection.query(`SELECT * FROM read_parquet('${opfsFileName}') LIMIT 1`);

    console.log('✅ Parquet loaded from OPFS cache');
    parquetPath = opfsFileName;
    loadedFromOPFS = true;

    migrationProgress.set({
      isRunning: true,
      stage: 'downloading',
      percentage: 40,
      message: 'Datos cargados desde caché'
    });
  } catch (error) {
    console.error(' Parquet not in OPFS, downloading from network...', error);
  }

  // Download from network if not in OPFS
  if (!loadedFromOPFS) {
    migrationProgress.set({
      isRunning: true,
      stage: 'downloading',
      percentage: 0,
      message: 'Descargando datos...'
    });

    const response = await fetch(`/${DATA_FILE_NAME}`);
    const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10);
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const chunks: Uint8Array[] = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      const downloadPercentage = contentLength > 0 ? (receivedLength / contentLength) * 40 : 10;

      migrationProgress.set({
        isRunning: true,
        stage: 'downloading',
        percentage: downloadPercentage,
        message: `Descargando datos... ${Math.round(downloadPercentage)}%`,
        downloadProgress: {
          loaded: receivedLength,
          total: contentLength
        }
      });
    }

    // Combine chunks
    const buffer = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, position);
      position += chunk.length;
    }

    // Register in memory
    await db.registerFileBuffer(DATA_FILE_NAME, buffer);

    // Cache to OPFS
    try {
      await connection.query(
        `COPY (SELECT * FROM read_parquet('${DATA_FILE_NAME}')) TO '${opfsFileName}' (FORMAT PARQUET)`
      );
      console.log('✅ Cached parquet to OPFS');
    } catch (error) {
      console.warn('Could not cache to OPFS:', error);
    }

    parquetPath = DATA_FILE_NAME;
  }

  // Stage 2: Create table (40-50%)
  migrationProgress.set({
    isRunning: true,
    stage: 'creating-table',
    percentage: 40,
    message: 'Creando tabla de palabras...'
  });

  await connection.query(`CREATE OR REPLACE TABLE ${WORDS_TABLE} AS
    SELECT
            id,
            word,
            definition,
            example,
            createdBy.name AS createdByName,
            createdBy.website AS createdByWebsite,
            createdAt
    FROM read_parquet('${parquetPath}')`);

  // Stage 3: Build FTS index (50-80%)
  migrationProgress.set({
    isRunning: true,
    stage: 'building-fts',
    percentage: 50,
    message: 'Construyendo índice de búsqueda...'
  });

  await connection.query('LOAD fts');
  await connection.query(
    `PRAGMA create_fts_index('${WORDS_TABLE}', 'id', 'word', 'definition', 'example', overwrite=1)`
  );

  // Stage 4: Build additional indexes (80-100%)
  migrationProgress.set({
    isRunning: true,
    stage: 'building-indexes',
    percentage: 80,
    message: 'Construyendo índices adicionales...'
  });

  await connection.query(`CREATE INDEX IF NOT EXISTS idx_words_id ON ${WORDS_TABLE}(id)`);
  await connection.query(`CREATE INDEX IF NOT EXISTS idx_words_word ON ${WORDS_TABLE}(word, id)`);

  // Complete
  migrationProgress.set({
    isRunning: false,
    stage: 'complete',
    percentage: 100,
    message: 'Base de datos lista'
  });
};

export interface QueryAllOptions {
  term?: string;
  cursor?: string | null;
  pageSize?: number;
}

export interface QueryAllResult {
  items: Word[];
  total: number;
  currentCursor: string | null;
  nextCursor: string | null;
  prevCursor: string | null;
  startIndex: number;
  endIndex: number;
  currentPage: number;
  totalPages: number;
  pages: Array<{ number: number; cursor: string | null }>;
  loadTimeSeconds: number;
}

export const queryAll = async (options: QueryAllOptions = {}): Promise<QueryAllResult> => {
  const connection = await getConnection();
  const startedAt = Date.now();
  const term = options.term?.trim() ?? '';
  const pageSize = Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE);
  const cursor = options.cursor?.trim() || null;

  const isSearch = term.length > 0;

  const rankedCte = isSearch
    ? `WITH base AS (
                SELECT
                    id,
                    word,
                    definition,
                    example,
                    createdByName,
                    createdByWebsite,
                    createdAt,
                    CASE
                        WHEN fts_main_words.match_bm25(id, ?, fields := 'word') IS NOT NULL THEN 1
                        ELSE 0
                    END AS word_match
                FROM ${WORDS_TABLE}
                WHERE fts_main_words.match_bm25(id, ?, fields := 'word,definition') IS NOT NULL
            ),
            ranked AS (
                SELECT
                    id,
                    word,
                    definition,
                    example,
                    createdByName,
                    createdByWebsite,
                    createdAt,
                    ROW_NUMBER() OVER (ORDER BY word_match DESC, LOWER(word), word, id) AS rn
                FROM base
            )`
    : `WITH base AS (
                SELECT
                    id,
                    word,
                    definition,
                    example,
                    createdByName,
                    createdByWebsite,
                    createdAt,
                    0 AS word_match
                FROM ${WORDS_TABLE}
            ),
            ranked AS (
                SELECT
                    id,
                    word,
                    definition,
                    example,
                    createdByName,
                    createdByWebsite,
                    createdAt,
                    ROW_NUMBER() OVER (ORDER BY word_match DESC, LOWER(word), word, id) AS rn
                FROM base
            )`;

  const totalSql = `${rankedCte}
        SELECT COUNT(*)::BIGINT AS total
        FROM ranked`;

  const lookupSql = `${rankedCte}
        SELECT rn
        FROM ranked
        WHERE id = ?`;

  const pageSql = `${rankedCte}
        SELECT id, word, definition, example, createdByName, createdByWebsite, createdAt
        FROM ranked
        WHERE rn BETWEEN ? AND ?
        ORDER BY rn`;

  type CountRow = { total: bigint | number };
  type RowNumberRow = { rn: bigint | number | null };

  const toNumber = (value: bigint | number | null | undefined): number => {
    if (typeof value === 'bigint') {
      return Number(value);
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    return 0;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runQuery = async (statement: AsyncPreparedStatement<any>, ...args: unknown[]) => {
    if (isSearch) {
      return statement.query(term, term, ...args);
    }
    return statement.query(...args);
  };

  const totalStatement = await connection.prepare(totalSql);
  let total = 0;

  try {
    const totalTable = await runQuery(totalStatement);
    const totalRow = tableToRows<CountRow>(totalTable)[0];
    total = toNumber(totalRow?.total);
  } finally {
    await totalStatement.close();
  }

  let startIndex = total > 0 ? 1 : 0;

  if (cursor) {
    const lookupStatement = await connection.prepare(lookupSql);
    try {
      const lookupTable = await runQuery(lookupStatement, cursor);
      const lookupRow = tableToRows<RowNumberRow>(lookupTable)[0];
      const rowNumber = toNumber(lookupRow?.rn);
      if (rowNumber > 0 && rowNumber <= total) {
        startIndex = rowNumber;
      }
    } finally {
      await lookupStatement.close();
    }
  }

  if (total === 0) {
    const loadTimeSeconds = (Date.now() - startedAt) / 1000;
    return {
      items: [],
      total: 0,
      currentCursor: null,
      nextCursor: null,
      prevCursor: null,
      startIndex: 0,
      endIndex: 0,
      currentPage: 1,
      totalPages: 1,
      pages: [],
      loadTimeSeconds
    };
  }

  const endIndex = Math.min(total, startIndex + pageSize - 1);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.max(1, Math.floor((startIndex - 1) / pageSize) + 1);

  const pageStatement = await connection.prepare(pageSql);
  let items: Word[] = [];

  try {
    const pageTable = await runQuery(pageStatement, startIndex, endIndex);
    items = tableToRows<WordParquetRow>(pageTable).map(toWordRecord);
  } finally {
    await pageStatement.close();
  }

  const currentCursor = items[0]?.id ?? null;

  // Calculate which cursor positions we need to fetch
  let prevCursor: string | null = null;
  let nextCursor: string | null = null;
  const pages: Array<{ number: number; cursor: string | null }> = [];

  const MAX_PAGE_LINKS = 4;
  let startPageNum = Math.max(1, currentPage - Math.floor(MAX_PAGE_LINKS / 2));
  const endPageNum = Math.min(totalPages, startPageNum + MAX_PAGE_LINKS - 1);
  const visibleCount = endPageNum - startPageNum + 1;
  if (visibleCount < MAX_PAGE_LINKS) {
    startPageNum = Math.max(1, endPageNum - MAX_PAGE_LINKS + 1);
  }

  // Collect all row numbers we need to fetch at once
  const rowNumbersToFetch: number[] = [];

  // Prev cursor position
  if (currentPage > 1 && currentPage !== 2) {
    const prevStartIndex = Math.max(1, startIndex - pageSize);
    rowNumbersToFetch.push(prevStartIndex);
  }

  // Next cursor position
  if (endIndex < total) {
    rowNumbersToFetch.push(endIndex + 1);
  }

  // Page cursor positions
  for (let pageNumber = startPageNum; pageNumber <= endPageNum; pageNumber += 1) {
    if (pageNumber > 1 && pageNumber !== currentPage) {
      const pageStartIndex = (pageNumber - 1) * pageSize + 1;
      rowNumbersToFetch.push(pageStartIndex);
    }
  }

  // Fetch all cursors in a single query to avoid Safari transaction issues
  const cursorsMap = new Map<number, string>();
  if (rowNumbersToFetch.length > 0) {
    const batchCursorSql = `${rankedCte}
            SELECT rn, id
            FROM ranked
            WHERE rn IN (${rowNumbersToFetch.join(',')})`;

    const batchStatement = await connection.prepare(batchCursorSql);
    try {
      const batchTable = await runQuery(batchStatement);
      const batchRows = tableToRows<{ rn: bigint | number; id: string }>(batchTable);
      for (const row of batchRows) {
        cursorsMap.set(toNumber(row.rn), row.id);
      }
    } finally {
      await batchStatement.close();
    }
  }

  // Assign cursors from the fetched batch
  if (currentPage > 1) {
    if (currentPage === 2) {
      prevCursor = null;
    } else {
      const prevStartIndex = Math.max(1, startIndex - pageSize);
      prevCursor = cursorsMap.get(prevStartIndex) ?? null;
    }
  }

  nextCursor = endIndex < total ? (cursorsMap.get(endIndex + 1) ?? null) : null;

  // Build pages array
  for (let pageNumber = startPageNum; pageNumber <= endPageNum; pageNumber += 1) {
    if (pageNumber === 1) {
      pages.push({ number: pageNumber, cursor: null });
    } else if (pageNumber === currentPage) {
      pages.push({
        number: pageNumber,
        cursor: currentPage === 1 ? null : currentCursor
      });
    } else {
      const pageStartIndex = (pageNumber - 1) * pageSize + 1;
      const cursor = cursorsMap.get(pageStartIndex) ?? null;
      pages.push({ number: pageNumber, cursor });
    }
  }

  const loadTimeSeconds = (Date.now() - startedAt) / 1000;

  return {
    items,
    total,
    currentCursor,
    nextCursor,
    prevCursor,
    startIndex,
    endIndex,
    currentPage,
    totalPages,
    pages,
    loadTimeSeconds
  }
};

export interface QuerySuggestionsOptions {
  term: string;
  limit?: number;
}

export const querySuggestions = async (options: QuerySuggestionsOptions): Promise<WordSuggestion[]> => {
  const term = options.term.trim();
  if (!term) {
    return [];
  }

  const limit = Math.max(1, options.limit ?? 5);
  const connection = await getConnection();
  const suggestionSql = `
        WITH fts_base AS (
            SELECT
                id,
                word,
                definition,
                fts_main_words.match_bm25(id, ?, fields := 'word,definition') AS score,
                fts_main_words.match_bm25(id, ?, fields := 'word') AS word_score
            FROM ${WORDS_TABLE}
        ),
        fts_results AS (
            SELECT
                id,
                word,
                definition,
                score,
                CASE WHEN word_score IS NOT NULL THEN 1 ELSE 0 END AS word_match
            FROM fts_base
            WHERE score IS NOT NULL
        ),
        prefix_results AS (
            SELECT
                id,
                word,
                definition,
                CAST(NULL AS DOUBLE) AS score,
                1 AS word_match
            FROM ${WORDS_TABLE}
            WHERE lower(word) LIKE lower(?)
                AND id NOT IN (SELECT id FROM fts_results)
        ),
        combined AS (
            SELECT id, word, definition, score, word_match, 1 AS priority FROM fts_results
            UNION ALL
            SELECT id, word, definition, score, word_match, 2 AS priority FROM prefix_results
        )
        SELECT id, word, definition
        FROM combined
        ORDER BY priority, word_match DESC, score DESC NULLS LAST, LOWER(word), word, id
        LIMIT ?`;

  const suggestionStatement = await connection.prepare(suggestionSql);
  try {
    const prefixTerm = `${term}%`;
    const table = await suggestionStatement.query(term, term, prefixTerm, limit);
    return tableToRows<WordSuggestion>(table);
  } finally {
    await suggestionStatement.close();
  }
};

const tableToRows = <T>(table: Table): T[] => table.toArray() as T[];

const toWordRecord = (row: WordParquetRow): Word => ({
  id: row.id,
  word: row.word,
  definition: row.definition,
  example: row.example,
  createdBy: {
    name: row.createdByName,
    website: row.createdByWebsite
  },
  createdAt: row.createdAt
});

