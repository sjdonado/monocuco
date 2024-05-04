declare interface Author {
  name: string;
  link: string;
}

declare interface Word {
  text: string;
  meaning: string;
  synonyms: string[];
  examples: string[];
  authors: Author[];
}

declare interface SearchResult {
  id: number;
  word: Word;
}
