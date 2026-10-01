import { firstLetter } from "$lib/text.js";

// Facts about the site that the pages, the Markdown version, the sitemap and the API share.

export const SITE_URL = "https://monocuco.sjdonado.com";
export const SITE_NAME = "Monocuco";
export const SITE_DESCRIPTION =
  "Monocuco, diccionario abierto y gratuito de español barranquillero: palabras y expresiones de Barranquilla con su definición y ejemplos.";

/** The address of a word's own page. `q` is dropped: it only names the search it came from. */
export const wordPath = (id: string) => `/?word=${encodeURIComponent(id)}`;
export const letterPath = (letter: string) => `/?letter=${encodeURIComponent(letter)}`;

/**
 * The one address search engines should keep for a page: only the parameters that change what
 * the page shows, in a fixed order. A word page is its word; a list is its letter and page.
 */
export const canonicalPath = (url: URL): string => {
  // Only the home page has states in its query; prerendered pages may not read it at all.
  if (url.pathname !== "/") return url.pathname;
  const params = url.searchParams;
  const word = params.get("word")?.trim();
  if (word) return wordPath(word);
  const canonical = new URLSearchParams();
  const q = params.get("q")?.trim();
  // `?letter=m` and `?letter=é` are the pages for M and E; a search ignores the letter.
  const letter = q ? "" : firstLetter(params.get("letter")?.trim() ?? "");
  const after = params.get("after")?.trim();
  if (q) canonical.set("q", q);
  if (letter) canonical.set("letter", letter);
  if (after) canonical.set("after", after);
  const query = canonical.toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
};

/** A definition without its Markdown marks, for meta descriptions and structured data. */
export const plainText = (markdown: string): string =>
  markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
