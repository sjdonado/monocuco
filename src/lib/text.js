/**
 * Text rules shared by the data build (scripts/) and the client (src/), so the
 * published index, the browse order and the letter row can never disagree.
 */

const collator = new Intl.Collator("es", { sensitivity: "base" });

/**
 * Removes accents but keeps ñ, which is its own letter in Spanish.
 * @param {string} text
 * @returns {string}
 */
const foldAccents = (text) =>
  Array.from(text.normalize("NFC"), (char) =>
    char === "ñ" || char === "Ñ" ? char : char.normalize("NFD").replace(/\p{M}/gu, "")
  ).join("");

/**
 * The letter a word is filed under: skip leading punctuation ("¡A vaina!" is under A),
 * drop accents ("Éxito" is under E), keep Ñ.
 * @param {string} word
 * @returns {string}
 */
export const firstLetter = (word) =>
  foldAccents(
    word
      .normalize("NFC")
      .replace(/^[^\p{L}]+/u, "")
      .charAt(0)
      .toLowerCase()
  ).toUpperCase();

/**
 * Dictionary order: Spanish collation on the word without leading punctuation, so "Ajá"
 * sits next to "Aja", accented initials with their letter and Ñ after N.
 * @param {{ word: string }} a
 * @param {{ word: string }} b
 * @returns {number}
 */
export const compareWords = (a, b) =>
  collator.compare(a.word.replace(/^[^\p{L}]+/u, ""), b.word.replace(/^[^\p{L}]+/u, "")) ||
  (a.word < b.word ? -1 : a.word > b.word ? 1 : 0);

/**
 * How the search index and every query normalize a term: lower case, accents folded, ñ kept.
 * "aja" and "ajá" are the same term.
 * @param {string} term
 * @returns {string}
 */
export const processTerm = (term) => foldAccents(term.toLowerCase());
