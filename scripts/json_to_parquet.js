#!/usr/bin/env node
/**
 * Convert the JSON dataset into the Parquet format used by the app.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID, createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_JSON_PATH = resolve(__dirname, '../data.json');
const DEFAULT_PARQUET_PATH = resolve(__dirname, '../static/data.parquet');
const DEFAULT_METADATA_PATH = resolve(__dirname, '../static/data.parquet.json');

/**
 * CreatedBy structure
 * @typedef {Object} CreatedBy
 * @property {string | null} name - Author name
 * @property {string | null} website - Author website
 */

/**
 * Entry structure
 * @typedef {Object} NormalizedEntry
 * @property {string} id - Unique identifier
 * @property {string} word - Word or expression
 * @property {string} definition - Definition
 * @property {string} example - Usage example
 * @property {CreatedBy} createdBy - Author information
 * @property {string} createdAt - ISO timestamp
 */

/**
 * Load JSON data
 * @param {string} jsonPath - Path to JSON file
 * @returns {any[]} Array of entries
 */
function loadJson(jsonPath) {
	const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
	if (!Array.isArray(data)) {
		throw new Error('Dataset JSON must be a list of entries');
	}
	return data;
}

/**
 * Convert value to string
 * @param {any} value - Value to convert
 * @returns {string} String representation
 */
function toStr(value) {
	if (typeof value === 'string') return value;
	return value != null ? String(value) : '';
}

/**
 * Convert value to optional string
 * @param {any} value - Value to convert
 * @returns {string | null} String or null
 */
function toOptionalStr(value) {
	const text = toStr(value);
	return text || null;
}

/**
 * Coerce raw entry to normalized format
 * @param {any} raw - Raw entry data
 * @returns {NormalizedEntry} Normalized entry
 */
function coerceEntry(raw) {
	const rawId = raw.id;
	let entryId;
	if (typeof rawId === 'string' && rawId.trim()) {
		entryId = rawId.trim();
	} else {
		entryId = randomUUID();
	}

	if ('word' in raw) {
		const createdBy = raw.createdBy || {};
		return {
			id: entryId,
			word: toStr(raw.word),
			definition: toStr(raw.definition || ''),
			example: toStr(raw.example || ''),
			createdBy: {
				name: toOptionalStr(createdBy.name),
				website: toOptionalStr(createdBy.website)
			},
			createdAt: toStr(raw.createdAt || '')
		};
	}

	// Handle old format with synonyms and authors
	const synonyms = raw.synonyms || [];
	const cleanedSynonyms = synonyms
		.map((s) => toStr(s).trim())
		.filter((s) => s)
		.join(', ');

	let definition = toStr(raw.meaning || '').trim();
	if (cleanedSynonyms) {
		definition = `${definition}\n\nSinónimos: ${cleanedSynonyms}`;
	}

	const authors = raw.authors || [];
	const authorNames = authors
		.map((a) => toStr(a.name).trim())
		.filter((name) => name)
		.join(', ');
	const authorWebsites = authors
		.map((a) => toStr(a.link).trim())
		.filter((link) => link)
		.join(', ');

	return {
		id: entryId,
		word: toStr(raw.text || ''),
		definition,
		example: (raw.examples || []).map((ex) => toStr(ex).trim()).join('\n'),
		createdBy: {
			name: authorNames || null,
			website: authorWebsites || null
		},
		createdAt: toStr(raw.createdAt || '2021-08-31T00:00:00.000Z')
	};
}

/**
 * Transform entries to normalized format
 * @param {any[]} data - Array of raw entries
 * @returns {NormalizedEntry[]} Array of normalized entries
 */
function transformEntries(data) {
	return data.map((entry) => coerceEntry(entry));
}

/**
 * Write parquet file
 * @param {NormalizedEntry[]} entries - Array of normalized entries
 * @param {string} parquetPath - Path to parquet file
 * @returns {Promise<void>}
 */
async function writeParquet(entries, parquetPath) {
	const { parquetWriteFile } = await import('hyparquet-writer');

	mkdirSync(dirname(parquetPath), { recursive: true });

	const columnData = [
		{ name: 'id', data: entries.map((e) => e.id), type: 'STRING' },
		{ name: 'word', data: entries.map((e) => e.word), type: 'STRING' },
		{ name: 'definition', data: entries.map((e) => e.definition), type: 'STRING' },
		{ name: 'example', data: entries.map((e) => e.example), type: 'STRING' },
		{ name: 'createdBy', data: entries.map((e) => e.createdBy) },
		{ name: 'createdAt', data: entries.map((e) => e.createdAt), type: 'STRING' }
	];

	await parquetWriteFile({
		filename: parquetPath,
		columnData
	});
}

/**
 * Save normalized JSON
 * @param {NormalizedEntry[]} entries - Array of normalized entries
 * @param {string} jsonPath - Path to JSON file
 * @returns {void}
 */
function saveJson(entries, jsonPath) {
	writeFileSync(jsonPath, JSON.stringify(entries, null, 2), 'utf-8');
}

/**
 * Generate metadata for parquet file
 * @param {string} parquetPath - Path to parquet file
 * @param {string} metadataPath - Path to metadata file
 * @returns {void}
 */
function generateMetadata(parquetPath, metadataPath) {
	const fileBuffer = readFileSync(parquetPath);
	const hash = createHash('sha256').update(fileBuffer).digest('hex');

	const metadata = {
		hash,
		version: '1.0',
		createdAt: new Date().toISOString(),
		fileSize: fileBuffer.length
	};

	writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
	console.log(
		`✅ Generated metadata: hash=${hash.substring(0, 12)}..., size=${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`
	);
}

async function main() {
	const data = loadJson(DEFAULT_JSON_PATH);
	const entries = transformEntries(data);
	saveJson(entries, DEFAULT_JSON_PATH);
	await writeParquet(entries, DEFAULT_PARQUET_PATH);
	console.log(
		`✅ Migrated ${entries.length} entries from ${DEFAULT_JSON_PATH} -> ${DEFAULT_PARQUET_PATH}`
	);
	generateMetadata(DEFAULT_PARQUET_PATH, DEFAULT_METADATA_PATH);
}

main().catch((err) => {
	console.error('Error:', err);
	process.exit(1);
});
