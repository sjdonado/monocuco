import lunr from 'lunr';

import DATA from '../data.json';

const index = lunr(function init() {
  this.field('text');
  this.field('meaning');
  this.field('synonyms');
  this.field('examples');

  (DATA as Word[]).forEach(({
    text,
    meaning,
    synonyms,
    examples,
  }, idx) => {
    this.add({
      id: idx,
      text,
      meaning,
      synonyms: synonyms.join(', '),
      examples: examples.join(', '),
    });
  });
});

export const search = (word: string): Word[] => {
  const matches = index.search(word);
  const words = matches.filter(({ score }) => score >= 1)
    .map(({ ref }) => DATA[Number(ref)]);
  return words;
};

export const TOTAL_WORDS: number = DATA.length;

export const searchPaginator: SearchPaginator = {
  perPage: 6,
  firstResults: DATA.slice(0, 6),
  fetch: function fetch(lastIndex: number) {
    const nextIndex = lastIndex + this.perPage;
    if (nextIndex > DATA.length) {
      return DATA;
    }
    const result = DATA.slice(0, nextIndex);
    return result;
  },
};
