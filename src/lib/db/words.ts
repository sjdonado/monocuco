import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
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
	db: AsyncDuckDB
): Promise<void> => {
	const response = await fetch(`/${DATA_FILE_NAME}`);
	const buffer = new Uint8Array(await response.arrayBuffer());
	await db.registerFileBuffer(DATA_FILE_NAME, buffer);

	await connection.query(`CREATE OR REPLACE TABLE ${WORDS_TABLE} AS
		SELECT
			id,
			word,
			definition,
			example,
			createdBy.name AS createdByName,
			createdBy.website AS createdByWebsite,
			createdAt
		FROM read_parquet('${DATA_FILE_NAME}')`);

	await connection.query('INSTALL fts');
	await connection.query('LOAD fts');

	try {
		await connection.query(`PRAGMA drop_fts_index('${WORDS_TABLE}')`);
	} catch {
		// ignore missing index
	}

	await connection.query(
		`PRAGMA create_fts_index('${WORDS_TABLE}', 'id', 'word', 'definition', 'example')`
	);

	await connection.query(`CREATE INDEX IF NOT EXISTS idx_words_id ON ${WORDS_TABLE}(id)`);
	await connection.query(
		`CREATE INDEX IF NOT EXISTS idx_words_word ON ${WORDS_TABLE}(word, id)`
	);
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

	const rankedOrder = "ORDER BY LOWER(word), word, id";

	const rankedCte = isSearch
		? `WITH ranked AS (
			SELECT id, word, definition, example, createdByName, createdByWebsite, createdAt,
				ROW_NUMBER() OVER (${rankedOrder}) AS rn
			FROM (
				SELECT id, word, definition, example, createdByName, createdByWebsite, createdAt
				FROM ${WORDS_TABLE}
				WHERE fts_main_words.match_bm25(id, ?, fields := 'word,definition') IS NOT NULL
			)
		)`
		: `WITH ranked AS (
			SELECT id, word, definition, example, createdByName, createdByWebsite, createdAt,
				ROW_NUMBER() OVER (${rankedOrder}) AS rn
			FROM ${WORDS_TABLE}
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

	const cursorAtSql = `${rankedCte}
		SELECT id
		FROM ranked
		WHERE rn = ?`;

	type CountRow = { total: bigint | number };
	type RowNumberRow = { rn: bigint | number | null };
	type CursorRow = { id: string };

	const toNumber = (value: bigint | number | null | undefined): number => {
		if (typeof value === 'bigint') {
			return Number(value);
		}
		if (typeof value === 'number') {
			return Number.isFinite(value) ? value : 0;
		}
		return 0;
	};

	const totalStatement = await connection.prepare(totalSql);
	let total = 0;

	try {
		const totalTable = isSearch ? await totalStatement.query(term) : await totalStatement.query();
		const totalRow = tableToRows<CountRow>(totalTable)[0];
		total = toNumber(totalRow?.total);
	} finally {
		await totalStatement.close();
	}

	let startIndex = total > 0 ? 1 : 0;

	if (cursor) {
		const lookupStatement = await connection.prepare(lookupSql);
		try {
			const lookupTable = isSearch
				? await lookupStatement.query(term, cursor)
				: await lookupStatement.query(cursor);
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
		const pageTable = isSearch
			? await pageStatement.query(term, startIndex, endIndex)
			: await pageStatement.query(startIndex, endIndex);
		items = tableToRows<WordParquetRow>(pageTable).map(toWordRecord);
	} finally {
		await pageStatement.close();
	}

	const currentCursor = items[0]?.id ?? null;

	const cursorStatement = await connection.prepare(cursorAtSql);

	const fetchCursorAt = async (index: number): Promise<string | null> => {
		if (index < 1 || index > total) return null;
		const table = isSearch
			? await cursorStatement.query(term, index)
			: await cursorStatement.query(index);
		const row = tableToRows<CursorRow>(table)[0];
		return row?.id ?? null;
	};

	let prevCursor: string | null = null;
	let nextCursor: string | null = null;
	const pages: Array<{ number: number; cursor: string | null }> = [];

	try {
		if (currentPage > 1) {
			if (currentPage === 2) {
				prevCursor = null;
			} else {
				const prevStartIndex = Math.max(1, startIndex - pageSize);
				prevCursor = await fetchCursorAt(prevStartIndex);
			}
		} else {
			prevCursor = null;
		}

		nextCursor = endIndex < total ? await fetchCursorAt(endIndex + 1) : null;

		const MAX_PAGE_LINKS = 4;
		let startPage = Math.max(1, currentPage - Math.floor(MAX_PAGE_LINKS / 2));
		let endPage = Math.min(totalPages, startPage + MAX_PAGE_LINKS - 1);
		const visibleCount = endPage - startPage + 1;
		if (visibleCount < MAX_PAGE_LINKS) {
			startPage = Math.max(1, endPage - MAX_PAGE_LINKS + 1);
		}

		for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
			if (pageNumber === 1) {
				pages.push({ number: pageNumber, cursor: null });
				continue;
			}
			if (pageNumber === currentPage) {
				pages.push({
					number: pageNumber,
					cursor: currentPage === 1 ? null : currentCursor
				});
				continue;
			}
			const pageStartIndex = (pageNumber - 1) * pageSize + 1;
			const cursor = await fetchCursorAt(pageStartIndex);
			pages.push({ number: pageNumber, cursor });
		}
	} finally {
		await cursorStatement.close();
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

export const querySuggestions = async (options: QuerySuggestionsOptions): Promise<WordSuggestion[]> => {
	const term = options.term.trim();
	if (!term) {
		return [];
	}

	const limit = Math.max(1, options.limit ?? 5);
	const connection = await getConnection();
	const suggestionSql = `
		WITH fts_results AS (
			SELECT id, word, definition,
				fts_main_words.match_bm25(id, ?, fields := 'word,definition') AS score
			FROM ${WORDS_TABLE}
			WHERE score IS NOT NULL
		),
		prefix_results AS (
			SELECT id, word, definition,
				CAST(NULL AS DOUBLE) AS score
			FROM ${WORDS_TABLE}
			WHERE lower(word) LIKE lower(?)
				AND id NOT IN (SELECT id FROM fts_results)
		),
		combined AS (
			SELECT id, word, definition, score, 1 AS priority FROM fts_results
			UNION ALL
			SELECT id, word, definition, score, 2 AS priority FROM prefix_results
		)
		SELECT id, word, definition
		FROM combined
		ORDER BY priority, score DESC NULLS LAST, word
		LIMIT ?`;

	const suggestionStatement = await connection.prepare(suggestionSql);
	try {
		const prefixTerm = `${term}%`;
		const table = await suggestionStatement.query(term, prefixTerm, limit);
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
