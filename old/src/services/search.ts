import MiniSearch from 'minisearch';

import allWords from '../data.json';

const documents = allWords.map((doc, idx) => ({ id: idx, ...doc }));

const miniSearch = new MiniSearch({
  fields: ['text', 'meaning', 'synonyms', 'examples'],
  searchOptions: {
    fuzzy: 0.3,
  },
});

miniSearch.addAll(documents);

export const search = (word: string): SearchResult[] => {
  const matches = miniSearch.search(word);

  const words = matches
    .filter(({ score }) => score > 1)
    .map(({ id }) => ({ id, word: documents[id] }));

  return words;
};

export const initSearchResults = documents.map(({ id, ...word }) => ({ id, word }));
