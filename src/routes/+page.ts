import type { PageLoad } from "./$types";
import initialWordsData from "$lib/data/initial-words.json";
import type { Word } from "$lib/db/repository";

// Enable prerendering ONLY for the default home page (no query params)
export const prerender = true;

interface InitialWordsData {
  words: Word[];
  total: number;
  totalPages: number;
  pageSize: number;
  generatedAt: string;
}

export const load: PageLoad = () => {
  // Cast the imported JSON to the correct type
  const data = initialWordsData as InitialWordsData;

  return {
    // Prerendered initial words (first 12, alphabetically sorted)
    initialWords: data.words,
    totalWords: data.total,
    totalPages: data.totalPages,
    pageSize: data.pageSize,
    prerendered: true,
  };
};
