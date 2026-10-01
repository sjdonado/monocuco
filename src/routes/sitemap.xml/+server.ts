import { allWords, firstLetter, getLetterCounts } from "$lib/server/dictionary";
import { SITE_URL, letterPath, wordPath } from "$lib/site";

// Built once with the site: the pages, every letter and every word's own page.
export const prerender = true;

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const GET = async () => {
  const day = (iso: string) => iso.slice(0, 10);
  const latest = allWords.reduce((max, w) => (w.createdAt > max ? w.createdAt : max), "");
  const letters = (await getLetterCounts()).filter((l) => l.letter !== "Todas");
  // A letter page changes when a word under it is added.
  const newestUnder = new Map<string, string>();
  for (const w of allWords) {
    const letter = firstLetter(w.word);
    if (w.createdAt > (newestUnder.get(letter) ?? "")) newestUnder.set(letter, w.createdAt);
  }

  const entries: Array<[string, string | null]> = [
    ["/", day(latest)],
    ["/about", null],
    ["/privacy", null],
    ...letters.map((l): [string, string] => [
      letterPath(l.letter),
      day(newestUnder.get(l.letter)!),
    ]),
    ...allWords.map((w): [string, string] => [wordPath(w.id), day(w.createdAt)]),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      ([path, lastmod]) =>
        `<url><loc>${escapeXml(SITE_URL + path)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`
    ),
    "</urlset>",
    "",
  ].join("\n");

  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8" } });
};
