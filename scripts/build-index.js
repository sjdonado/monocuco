import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import MiniSearch from "minisearch";

/**
 * Build the client search index and normalized dataset.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INPUT_PATH = resolve(__dirname, "../data.json");
const OUTPUT_DATA_PATH = resolve(__dirname, "../static/data.json");
const OUTPUT_INDEX_PATH = resolve(__dirname, "../static/search-index.json");

/**
 * Coerce any value to a string
 * @param {unknown} value - Value to coerce
 * @returns {string} String value
 */
function toStr(value) {
  if (typeof value === "string") return value;
  return value != null ? String(value) : "";
}

/**
 * Normalize legacy/modern entries into the canonical format
 * @param {Record<string, unknown>} raw - Raw entry data
 * @returns {{
 *   id: string,
 *   word: string,
 *   definition: string,
 *   example: string,
 *   createdBy: { name: string, website: string },
 *   createdAt: string
 * }} Normalized entry
 */
function normalizeEntry(raw) {
  const rawId = raw.id;
  const entryId = typeof rawId === "string" && rawId.trim() ? rawId.trim() : randomUUID();

  // Handle normalized format
  if ("word" in raw && "createdBy" in raw) {
    return {
      id: entryId,
      word: toStr(raw.word),
      definition: toStr(raw.definition),
      example: toStr(raw.example),
      createdBy: {
        name: toStr(raw.createdBy.name),
        website: toStr(raw.createdBy.website),
      },
      createdAt: toStr(raw.createdAt),
    };
  }

  // Handle legacy format (if any still exists in data.json)
  const synonyms = raw.synonyms || [];
  const cleanedSynonyms = synonyms
    .map((s) => toStr(s).trim())
    .filter((s) => s)
    .join(", ");

  let definition = toStr(raw.meaning || "").trim();
  if (cleanedSynonyms) {
    definition = `${definition}\n\nSinónimos: ${cleanedSynonyms}`;
  }

  const authors = raw.authors || [];
  const firstAuthor = authors[0] || {};

  return {
    id: entryId,
    word: toStr(raw.text || ""),
    definition,
    example: (raw.examples || []).map((ex) => toStr(ex).trim()).join("\n"),
    createdBy: {
      name: toStr(firstAuthor.name || "Anónimo").trim() || "Anónimo",
      website: toStr(firstAuthor.link || "").trim(),
    },
    createdAt: toStr(raw.createdAt || "2021-08-31T00:00:00.000Z"),
  };
}

/**
 * Build and write the search index + normalized data
 * @returns {Promise<void>} Resolves when files are written
 */
async function build() {
  console.log("🏗️  Building search index...");

  const rawData = JSON.parse(readFileSync(INPUT_PATH, "utf-8"));
  if (!Array.isArray(rawData)) throw new Error("Data must be an array");

  const items = rawData.map(normalizeEntry).sort((a, b) => {
    const aWord = a.word.toLowerCase();
    const bWord = b.word.toLowerCase();
    if (aWord < bWord) return -1;
    if (aWord > bWord) return 1;
    return 0;
  });

  // 1. Configure MiniSearch
  // We index 'word' (primary) and 'definition'.
  // 'id' is the unique identifier.
  const miniSearch = new MiniSearch({
    fields: ["word", "definition"],
    storeFields: ["word", "definition"], // Store minimal fields for suggestions
    idField: "id",
    searchOptions: {
      boost: { word: 2, definition: 1.2 }, // Prefer matches in the word itself
      prefix: true,
    },
  });

  // 2. Index all items
  miniSearch.addAll(items);

  // 3. Export Index
  const indexJson = JSON.stringify(miniSearch.toJSON());
  writeFileSync(OUTPUT_INDEX_PATH, indexJson);
  console.log(
    `✅ Index written to ${OUTPUT_INDEX_PATH} (${(indexJson.length / 1024).toFixed(2)} KB)`
  );

  // 4. Export Clean Data (Client DB)
  // We write the normalized data to static/data.json so the client can fetch it
  writeFileSync(OUTPUT_DATA_PATH, JSON.stringify(items));
  console.log(
    `✅ Data written to ${OUTPUT_DATA_PATH} (${(JSON.stringify(items).length / 1024).toFixed(2)} KB)`
  );
}

build().catch(console.error);
