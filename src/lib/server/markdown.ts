// The home page as Markdown, for clients that ask for it with `Accept: text/markdown`.
import {
  findAll,
  firstLetter,
  findById,
  getLetterCounts,
  type QueryAllResult,
  type Word,
} from "$lib/server/dictionary";
import { SITE_DESCRIPTION, SITE_URL, letterPath, wordPath } from "$lib/site";

const PAGE_SIZE = 12;

const parseAccept = (accept: string | null) =>
  (accept ?? "").split(",").map((range) => {
    const q = /;\s*q=([\d.]+)/i.exec(range)?.[1];
    return {
      type: range.split(";")[0].trim().toLowerCase(),
      q: q === undefined ? 1 : Number(q) || 0,
    };
  });

/**
 * True when the client names `type` explicitly and asks for it at least as much as for HTML.
 * HTML's quality follows RFC 9110: `text/html`, else `text/*`, else `*` + `/*`. Wildcards never
 * count as a request for `type`, so browsers keep getting HTML.
 */
export const prefers = (accept: string | null, type: string): boolean => {
  const ranges = parseAccept(accept);
  const qualityOf = (name: string) =>
    ranges.filter((r) => r.type === name).reduce((max, r) => Math.max(max, r.q), -1);
  const wanted = qualityOf(type);
  const html = [qualityOf("text/html"), qualityOf("text/*"), qualityOf("*/*")].find((q) => q >= 0);
  return wanted > 0 && wanted >= (html ?? 0);
};

export const prefersMarkdown = (accept: string | null) => prefers(accept, "text/markdown");

/** Text from the URL, safe inside a Markdown line: one line, Markdown marks escaped. */
const inline = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .slice(0, 200)
    .replace(/[\\`*_[\]()#<>|!~{}+-]/g, "\\$&");

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const wordMarkdown = (word: Word, level = "##") => {
  const author = word.createdBy.website
    ? `[${word.createdBy.name}](${word.createdBy.website})`
    : word.createdBy.name;
  return [
    `${level} ${word.word}`,
    word.definition.trim(),
    word.example?.trim() ? `**Ejemplo:** ${word.example.trim()}` : "",
    `Aportada por ${author}, ${formatDate(word.createdAt)}. Enlace: ${SITE_URL}${wordPath(word.id)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
};

const pageLink = (url: URL, after: string | null) => {
  const next = new URL("/", SITE_URL);
  const q = url.searchParams.get("q")?.trim();
  const letter = firstLetter(url.searchParams.get("letter")?.trim() ?? "");
  if (q) next.searchParams.set("q", q);
  else if (letter) next.searchParams.set("letter", letter);
  if (after) next.searchParams.set("after", after);
  return next.toString();
};

const listMarkdown = async (url: URL, heading: string, result: QueryAllResult) => {
  const letters = (await getLetterCounts()).filter((l) => l.letter !== "Todas");
  const lines = [
    `# ${heading}`,
    `> ${SITE_DESCRIPTION}`,
    result.total === 0
      ? "No hay palabras para esta búsqueda."
      : `${plural(result.total, "palabra encontrada", "palabras encontradas")}${result.approximate ? " (parecidas a la búsqueda)" : ""}. Página ${result.currentPage} de ${result.totalPages}.`,
    ...result.items.map((word) => wordMarkdown(word)),
    "## Más",
    [
      result.currentPage > 1 ? `- Página anterior: ${pageLink(url, result.prevAfter)}` : "",
      result.nextAfter ? `- Página siguiente: ${pageLink(url, result.nextAfter)}` : "",
      `- Palabras por letra: ${letters.map((l) => `[${l.letter}](${SITE_URL}${letterPath(l.letter)}) (${l.count})`).join(", ")}`,
      `- Buscar: ${SITE_URL}/?q={palabra}`,
      `- API JSON: ${SITE_URL}/openapi.json`,
      `- Guía para agentes: ${SITE_URL}/llms.txt`,
    ]
      .filter(Boolean)
      .join("\n"),
  ];
  return lines.join("\n\n") + "\n";
};

/** The same state as the HTML page for this URL: a word, a search, a letter or a page of all. */
export const homeMarkdown = async (url: URL): Promise<{ status: number; body: string }> => {
  const get = (key: string) => url.searchParams.get(key)?.trim() || null;
  const wordId = get("word");
  if (wordId) {
    const word = await findById(wordId);
    if (!word) {
      return {
        status: 404,
        body: `# Palabra no encontrada\n\nNinguna palabra tiene el id ${inline(wordId)}. Busca la palabra en ${SITE_URL}/?q={palabra} o en ${SITE_URL}/api/words?q={palabra}.\n`,
      };
    }
    return { status: 200, body: `${wordMarkdown(word, "#")}\n\nMás palabras: ${SITE_URL}/\n` };
  }
  const term = get("q");
  const letter = term ? null : firstLetter(get("letter") ?? "") || null;
  const result = await findAll({
    term: term ?? undefined,
    letter,
    after: get("after"),
    pageSize: PAGE_SIZE,
  });
  const heading = term
    ? `Resultados para "${inline(term)}" en Monocuco`
    : result.items.length && letter
      ? `Palabras con ${letter} en Monocuco`
      : "Monocuco: diccionario de español barranquillero";
  return { status: 200, body: await listMarkdown(url, heading, result) };
};
