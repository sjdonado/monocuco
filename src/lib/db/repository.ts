import MiniSearch, { type SearchOptions } from "minisearch";
import { firstLetter, processTerm } from "$lib/text.js";

export { firstLetter };

const DATA_URL = "/data.json";
const INDEX_URL = "/search-index.json";
const DEFAULT_PAGE_SIZE = 12;

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

export type WordSuggestion = Pick<Word, "id" | "word" | "definition">;

// In-memory store
let items: Word[] = [];
let itemMap: Map<string, Word> = new Map();
let itemIndexMap: Map<string, number> = new Map(); // ID -> Index in 'items' array
let miniSearch: MiniSearch | null = null;
let initPromise: Promise<void> | null = null;
let initError: Error | null = null;

const normalizeInitError = (error: unknown): Error =>
  error instanceof Error ? error : new Error("Failed to initialize search data");

const SEARCH_BASE_OPTIONS: SearchOptions = {
  fields: ["word", "definition"],
  boost: { word: 2, definition: 1.2 },
  prefix: true,
};

// Every word of the query must match (AND), exactly or as a prefix. Only when nothing
// does, fall back to typo-tolerant matching, and then to any word of the query; those
// results are approximate and the page says so.
const searchWithFallback = (term: string) => {
  const attempts: SearchOptions[] = [
    { combineWith: "AND", fuzzy: 0 },
    { combineWith: "AND", fuzzy: 0.2 },
    { combineWith: "OR", fuzzy: 0.2 },
  ];
  for (const [index, attempt] of attempts.entries()) {
    const results = miniSearch!.search(term, { ...SEARCH_BASE_OPTIONS, ...attempt });
    if (results.length > 0) return { results, approximate: index > 0 };
  }
  return { results: [], approximate: false };
};

export const initDB = async () => {
  if (initError) return Promise.reject(initError);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const [dataRes, indexRes] = await Promise.all([fetch(DATA_URL), fetch(INDEX_URL)]);

      if (!dataRes.ok) throw new Error(`Failed to load data.json: ${dataRes.statusText}`);
      if (!indexRes.ok) throw new Error(`Failed to load search-index.json: ${indexRes.statusText}`);

      items = await dataRes.json();
      const indexJson = await indexRes.text();

      itemMap = new Map();
      itemIndexMap = new Map();
      items.forEach((item, idx) => {
        itemMap.set(item.id, item);
        itemIndexMap.set(item.id, idx);
      });

      miniSearch = MiniSearch.loadJSON(indexJson, {
        fields: ["word", "definition"],
        storeFields: ["word", "definition"],
        idField: "id",
        processTerm,
        searchOptions: {
          boost: { word: 2, definition: 1.2 },
          prefix: true,
        },
      });

      console.log(`[Repository] Search data initialized. ${items.length} words loaded.`);
    } catch (e) {
      const normalizedError = normalizeInitError(e);
      initError = normalizedError;
      miniSearch = null;
      items = [];
      itemMap = new Map();
      itemIndexMap = new Map();
      console.error("[Repository] Failed to init search data", normalizedError);
      // initPromise = null; // Allow retry
      throw normalizedError;
    }
  })();

  return initPromise;
};

const ensureDB = async () => {
  if (initError) throw initError;
  if (!miniSearch) await initDB();
};

export interface QueryAllOptions {
  term?: string;
  // Browse only the words whose first character is this letter (case-insensitive).
  letter?: string | null;
  after?: string | null;
  pageSize?: number;
}

export interface QueryAllResult {
  items: Word[];
  total: number;
  currentAfter: string | null;
  nextAfter: string | null;
  prevAfter: string | null;
  startIndex: number;
  endIndex: number;
  currentPage: number;
  totalPages: number;
  pages: Array<{ number: number; after: string | null }>;
  loadTimeSeconds: number;
  // True when no word matched exactly and the results come from typo-tolerant matching.
  approximate: boolean;
}

export const findAll = async (options: QueryAllOptions = {}): Promise<QueryAllResult> => {
  const startedAt = performance.now();
  await ensureDB();

  const term = options.term?.trim() ?? "";
  const pageSize = Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE);
  const after = options.after?.trim() || null;
  const letter = firstLetter(options.letter?.trim() ?? "") || null;

  let resultIds: string[] = [];
  let approximate = false;

  if (term.length > 0) {
    // Search mode
    // We don't support 'after' cursor for search results easily without caching the search result key
    // For simplicity in this static context, we just re-run search. it's fast.
    // However, pagination with 'after' in search results implies we know the order of search results.
    // MiniSearch returns sorted by relevance.
    const search = searchWithFallback(term);
    approximate = search.approximate;
    resultIds = search.results.map((r) => r.id);
  } else if (letter) {
    // Letter mode - the sorted list, only words starting with the letter
    resultIds = items.filter((i) => firstLetter(i.word) === letter).map((i) => i.id);
  } else {
    // Browse mode - use full sorted list
    resultIds = items.map((i) => i.id);
  }

  const total = resultIds.length;

  if (total === 0) {
    return emptyResult(startedAt);
  }

  let startIndex = 0;

  // Resolve 'after' to a startIndex
  if (after) {
    const foundIndex = resultIds.indexOf(after);
    if (foundIndex !== -1) {
      // 'after' points to the *last item* of the *previous page*, usually.
      // But the previous implementation treated 'after' as a start cursor?
      // Let's check previous implementation:
      // WHERE rn BETWEEN ? AND ?
      // It used 'startIndex' derived from 'rn'.
      // If 'after' provided, 'rn' of that ID became 'startIndex'.
      // So 'after' == "start at this ID".
      // Snap to the page the cursor is on, so a cursor saved before the order changed
      // (an old bookmark) still lands on a page boundary.
      startIndex = Math.floor(foundIndex / pageSize) * pageSize;
    }
  }

  // Adjust startIndex to be page-aligned if possible?
  // Previous implementation: "if (rowNumber > 0 && rowNumber <= total) startIndex = rowNumber;"
  // It seems 'after' was the ID of the *first item* on the page.

  const endIndex = Math.min(total, startIndex + pageSize); // Slice is exclusive at end
  const pageIds = resultIds.slice(startIndex, endIndex);

  const pageItems = pageIds.map((id) => itemMap.get(id)!).filter(Boolean);

  const currentPage = Math.floor(startIndex / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);

  // Pagination links generation
  const pages: Array<{ number: number; after: string | null }> = [];
  const MAX_PAGE_LINKS = 4;
  let startPageNum = Math.max(1, currentPage - Math.floor(MAX_PAGE_LINKS / 2));
  const endPageNum = Math.min(totalPages, startPageNum + MAX_PAGE_LINKS - 1);

  if (endPageNum - startPageNum + 1 < MAX_PAGE_LINKS) {
    startPageNum = Math.max(1, endPageNum - MAX_PAGE_LINKS + 1);
  }

  for (let i = startPageNum; i <= endPageNum; i++) {
    const pageStartIdx = (i - 1) * pageSize;
    // 'after' is the ID of the first item on that page
    const afterId = i === 1 ? null : (resultIds[pageStartIdx] ?? null);
    pages.push({ number: i, after: afterId });
  }

  const currentAfter = pageItems.length > 0 ? pageItems[0].id : null;

  // Previous/Next logic
  const prevStartIdx = Math.max(0, startIndex - pageSize);
  const nextStartIdx = startIndex + pageSize;

  const prevAfter = currentPage > 1 ? (resultIds[prevStartIdx] ?? null) : null;
  const nextAfter = nextStartIdx < total ? (resultIds[nextStartIdx] ?? null) : null;

  // Previous implementation returned 1-based indices for start/end
  // Slice is 0-based.
  // Display is 1-based.
  const displayStartIndex = total > 0 ? startIndex + 1 : 0;
  const displayEndIndex = Math.min(startIndex + pageSize, total);

  return {
    items: pageItems,
    total,
    currentAfter,
    nextAfter,
    prevAfter: currentPage === 2 ? null : prevAfter, // Logic from old repo: "if (currentPage === 2) prevAfter = null" (wait, page 1 has no after)
    startIndex: displayStartIndex,
    endIndex: displayEndIndex,
    currentPage,
    totalPages,
    pages,
    loadTimeSeconds: (performance.now() - startedAt) / 1000,
    approximate,
  };
};

function emptyResult(startedAt: number): QueryAllResult {
  return {
    items: [],
    total: 0,
    currentAfter: null,
    nextAfter: null,
    prevAfter: null,
    startIndex: 0,
    endIndex: 0,
    currentPage: 1,
    totalPages: 1,
    pages: [],
    loadTimeSeconds: (performance.now() - startedAt) / 1000,
    approximate: false,
  };
}

export interface QuerySuggestionsOptions {
  term: string;
  limit?: number;
}

export const findSuggestions = async (
  options: QuerySuggestionsOptions
): Promise<WordSuggestion[]> => {
  await ensureDB();
  const term = options.term.trim();
  if (!term) return [];

  const limit = Math.max(1, options.limit ?? 5);

  // MiniSearch is optimized for this
  const { results } = searchWithFallback(term);

  return results.slice(0, limit).map((r) => ({
    id: r.id,
    word: itemMap.get(r.id)?.word ?? "",
    definition: itemMap.get(r.id)?.definition ?? "",
  }));
};

export const findById = async (id: string): Promise<Word | null> => {
  await ensureDB();
  return itemMap.get(id) ?? null;
};

export interface LetterCount {
  letter: string;
  count: number;
}

export const getLetterCounts = async (): Promise<LetterCount[]> => {
  await ensureDB();

  const counts = new Map<string, number>();
  let total = 0;

  for (const item of items) {
    const letter = firstLetter(item.word);
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
    total++;
  }

  const result: LetterCount[] = [{ letter: "Todas", count: total }];

  const sortedLetters = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b, "es"));
  for (const letter of sortedLetters) {
    result.push({ letter, count: counts.get(letter)! });
  }

  return result;
};
