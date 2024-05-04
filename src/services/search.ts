import lunr from 'lunr';

import DATA from '../data.json';

const index = lunr(function init() {
  this.field('text');
  this.field('meaning');
  this.field('synonyms');
  this.field('examples');

  (DATA as Word[]).forEach(({ text, meaning, synonyms, examples }, idx) => {
    this.add({
      id: idx,
      text,
      meaning,
      synonyms: synonyms.join(', '),
      examples: examples.join(', '),
    });
  });
});

export const search = (word: string): SearchResult[] => {
  const matches = index.search(word);

  const words = matches
    .filter(({ score }) => score >= 1)
    .map(({ ref }) => ({ idx: ref, word: DATA[Number(ref)] }));

  return words;
};

export const initSearchResults = DATA.map((word, idx) => ({ idx: String(idx), word }));
