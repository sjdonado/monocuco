import { findAll, findById, type QueryAllResult, type Word } from "$lib/server/dictionary";
import type { LayoutServerLoad } from "./$types";

export interface ServerRendered {
  // The `url.search` this was rendered for; the page uses it only while the URL is the same.
  search: string;
  result: QueryAllResult | null;
  // On a word page: the entry, or null when no word has that id.
  word?: Word | null;
}

const PAGE_SIZE = 12;

// Runs once, for the page the visitor opens: the layout stays mounted and nothing here is
// tracked, so no navigation in the browser ever asks the worker again. Searches stay in the
// browser, and the site keeps working offline.
export const load: LayoutServerLoad = async ({ url, untrack }) => {
  const state = untrack(() => {
    // Prerendered pages may not read the query, and only the home page has states in it.
    if (url.pathname !== "/") return null;
    const get = (key: string) => url.searchParams.get(key)?.trim() || null;
    return {
      search: url.search,
      word: get("word"),
      q: get("q"),
      letter: get("letter"),
      after: get("after"),
    };
  });

  let ssr: ServerRendered | null = null;
  if (state?.word) {
    ssr = { search: state.search, result: null, word: await findById(state.word) };
  } else if (state && !state.q) {
    // A search is left to the browser: the index is too slow to load for every page view.
    const result = await findAll({ letter: state.letter, after: state.after, pageSize: PAGE_SIZE });
    ssr = { search: state.search, result };
  }
  return { ssr };
};
