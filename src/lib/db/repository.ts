import type { AsyncDuckDBConnection, AsyncPreparedStatement } from '@duckdb/duckdb-wasm';
import type { Table } from 'apache-arrow';
import { getConnection } from './duckdb';

const DATA_FILE_NAME = 'data.parquet';
const WORDS_TABLE = 'words';
const DEFAULT_PAGE_SIZE = 12;

interface WordParquetRow {
	id: string;
	word: string;
	definition: string;
	example: string;
	createdByName: string;
	createdByWebsite: string;
	createdAt: string;
}

export interface Word {
	id: string;
	word: string;
	definition: string;
	example: string;
	createdBy: {
		name: string;
		website: string;
	};
	createdAt: string;
}

export type WordSuggestion = Pick<Word, 'id' | 'word' | 'definition'>;

export async function downloadParquetFile(): Promise<{ name: string; buffer: Uint8Array }> {
	const res = await fetch(`/${DATA_FILE_NAME}`, { cache: 'no-cache' });
	if (!res.ok) {
		throw new Error(`Could not download ${DATA_FILE_NAME}: ${res.status} ${res.statusText}`);
	}

	const buffer = new Uint8Array(await res.arrayBuffer());
	return { name: DATA_FILE_NAME, buffer };
}

export const runMigration = async (connection: AsyncDuckDBConnection) => {
	await connection.query(`CREATE OR REPLACE TABLE ${WORDS_TABLE} AS
    SELECT
      id,
      word,
      definition,
      example,
      createdByName,
      createdByWebsite,
      createdAt
    FROM read_parquet('${DATA_FILE_NAME}')`);

	await connection.query('LOAD fts');
	await connection.query(
		`PRAGMA create_fts_index('${WORDS_TABLE}', 'id', 'word', 'definition', 'example', overwrite=1)`
	);

	await connection.query(`CREATE INDEX IF NOT EXISTS idx_words_id ON ${WORDS_TABLE}(id)`);
	await connection.query(`CREATE INDEX IF NOT EXISTS idx_words_word ON ${WORDS_TABLE}(word, id)`);
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

export const findAll = async (options: QueryAllOptions = {}): Promise<QueryAllResult> => {
	const connection = await getConnection();
	const startedAt = Date.now();
	const term = options.term?.trim() ?? '';
	const pageSize = Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE);
	const cursor = options.cursor?.trim() || null;

	const isSearch = term.length > 0;

	const rankedCte = isSearch
		? `WITH base AS (
         SELECT
           id, word, definition, example, createdByName, createdByWebsite, createdAt,
           CASE WHEN fts_main_words.match_bm25(id, ?, fields := 'word') IS NOT NULL THEN 1 ELSE 0 END AS word_match
         FROM ${WORDS_TABLE}
         WHERE fts_main_words.match_bm25(id, ?, fields := 'word,definition') IS NOT NULL
       ),
       ranked AS (
         SELECT
           id, word, definition, example, createdByName, createdByWebsite, createdAt,
           ROW_NUMBER() OVER (ORDER BY word_match DESC, LOWER(word), word, id) AS rn
         FROM base
       )`
		: `WITH base AS (
         SELECT
           id, word, definition, example, createdByName, createdByWebsite, createdAt, 0 AS word_match
         FROM ${WORDS_TABLE}
       ),
       ranked AS (
         SELECT
           id, word, definition, example, createdByName, createdByWebsite, createdAt,
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
		if (typeof value === 'bigint') return Number(value);
		if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
		return 0;
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const runQuery = async (statement: AsyncPreparedStatement<any>, ...args: unknown[]) => {
		if (isSearch) return statement.query(term, term, ...args);
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
			if (rowNumber > 0 && rowNumber <= total) startIndex = rowNumber;
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

	// Calculate links/cursors to fetch
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

	const rowNumbersToFetch: number[] = [];
	if (currentPage > 1 && currentPage !== 2) {
		const prevStartIndex = Math.max(1, startIndex - pageSize);
		rowNumbersToFetch.push(prevStartIndex);
	}
	if (endIndex < total) {
		rowNumbersToFetch.push(endIndex + 1);
	}
	for (let pageNumber = startPageNum; pageNumber <= endPageNum; pageNumber += 1) {
		if (pageNumber > 1 && pageNumber !== currentPage) {
			const pageStartIndex = (pageNumber - 1) * pageSize + 1;
			rowNumbersToFetch.push(pageStartIndex);
		}
	}

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

	if (currentPage > 1) {
		if (currentPage === 2) {
			prevCursor = null;
		} else {
			const prevStartIndex = Math.max(1, startIndex - pageSize);
			prevCursor = cursorsMap.get(prevStartIndex) ?? null;
		}
	}
	nextCursor = endIndex < total ? (cursorsMap.get(endIndex + 1) ?? null) : null;

	for (let pageNumber = startPageNum; pageNumber <= endPageNum; pageNumber += 1) {
		if (pageNumber === 1) {
			pages.push({ number: pageNumber, cursor: null });
		} else if (pageNumber === currentPage) {
			pages.push({ number: pageNumber, cursor: currentPage === 1 ? null : currentCursor });
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
	};
};

export interface QuerySuggestionsOptions {
	term: string;
	limit?: number;
}

export const findSuggestions = async (
	options: QuerySuggestionsOptions
): Promise<WordSuggestion[]> => {
	const term = options.term.trim();
	if (!term) return [];

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
      SELECT id, word, definition, score,
             CASE WHEN word_score IS NOT NULL THEN 1 ELSE 0 END AS word_match
      FROM fts_base
      WHERE score IS NOT NULL
    ),
    prefix_results AS (
      SELECT id, word, definition, CAST(NULL AS DOUBLE) AS score, 1 AS word_match
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

export const findById = async (id: string): Promise<Word | null> => {
	const connection = await getConnection();
	const sql = `
    SELECT id, word, definition, example, createdByName, createdByWebsite, createdAt
    FROM ${WORDS_TABLE}
    WHERE id = ?
    LIMIT 1`;

	const statement = await connection.prepare(sql);
	try {
		const table = await statement.query(id);
		const rows = tableToRows<WordParquetRow>(table);
		return rows.length > 0 ? toWordRecord(rows[0]) : null;
	} finally {
		await statement.close();
	}
};

const tableToRows = <T>(table: Table): T[] => table.toArray() as T[];

const toWordRecord = (row: WordParquetRow): Word => ({
	id: row.id,
	word: row.word,
	definition: row.definition,
	example: row.example,
	createdBy: { name: row.createdByName, website: row.createdByWebsite },
	createdAt: row.createdAt
});
