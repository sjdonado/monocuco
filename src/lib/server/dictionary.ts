// The dictionary on the server: the published words are part of the worker bundle, so pages,
// the Markdown version, the sitemap and the API never fetch them.
import words from "../../../static/data.json";
import {
  findAll as findAllWords,
  seedIndex,
  seedWords,
  type QueryAllOptions,
  type Word,
} from "$lib/db/repository";

seedWords(words as Word[]);

export const allWords = words as Word[];

let indexLoaded = false;
/** Loads the search index the first time a request searches; it is too slow for every page. */
export const ensureIndex = async () => {
  if (indexLoaded) return;
  const { default: indexJson } = await import("../../../static/search-index.json?raw");
  seedIndex(indexJson);
  indexLoaded = true;
};

// Searches load the index first. Without it the repository would try to fetch the data
// with a relative URL, fail, and stay failed for every request this worker serves.
export const findAll = async (options: QueryAllOptions = {}) => {
  if (options.term?.trim()) await ensureIndex();
  return findAllWords(options);
};

export { findById, firstLetter, getLetterCounts } from "$lib/db/repository";
export type { QueryAllResult, Word } from "$lib/db/repository";
