import type { PageLoad } from "./$types";
import initialWordsData from "$lib/data/initial-words.json";
import type { Word } from "$lib/db/repository";

interface InitialWordsData {
  words: Word[];
  total: number;
  totalPages: number;
  pageSize: number;
  pages: Array<{ number: number; after: string | null }>;
  nextAfter: string | null;
  generatedAt: string;
}

// The first page, built with the site: the fallback while the data loads for a search, and
// when it cannot load at all.
export const load: PageLoad = () => {
  const data = initialWordsData as InitialWordsData;
  return {
    initialWords: data.words,
    totalWords: data.total,
    totalPages: data.totalPages,
    pageSize: data.pageSize,
    pages: data.pages,
    nextAfter: data.nextAfter,
  };
};
