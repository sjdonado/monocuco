import { findAll, firstLetter } from "$lib/server/dictionary";
import { guarded, methodNotAllowed, ok, preflight, problem, toApiWord } from "$lib/server/api";
import { SITE_URL } from "$lib/site";
import type { RequestHandler } from "./$types";

const PARAMETERS = ["q", "letter", "after", "limit"];
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

export const GET: RequestHandler = guarded(async ({ url }) => {
  const params = url.searchParams;
  const unknown = [...params.keys()].find((key) => !PARAMETERS.includes(key));
  if (unknown) {
    return problem(
      400,
      "unknown_parameter",
      `The parameter "${unknown}" is not supported.`,
      `Use only ${PARAMETERS.join(", ")}.`
    );
  }
  const get = (key: string) => params.get(key)?.trim() || null;
  const q = get("q");
  const letterParam = get("letter")?.normalize("NFC") ?? null;
  const after = get("after");
  const limitParam = get("limit");

  if (q && letterParam) {
    return problem(
      400,
      "conflicting_parameters",
      "q and letter cannot be combined.",
      "Search with q, or browse a letter with letter."
    );
  }
  const letter = letterParam ? firstLetter(letterParam) : null;
  if (letterParam && (Array.from(letterParam).length !== 1 || !letter)) {
    return problem(
      400,
      "invalid_letter",
      `"${letterParam}" is not a single letter.`,
      "Pass one letter, for example letter=M or letter=Ñ."
    );
  }
  const limit = limitParam === null ? DEFAULT_LIMIT : Number(limitParam);
  if ((limitParam !== null && !/^\d+$/.test(limitParam)) || limit < 1 || limit > MAX_LIMIT) {
    return problem(
      400,
      "invalid_limit",
      `limit must be a whole number from 1 to ${MAX_LIMIT}.`,
      `Omit limit for ${DEFAULT_LIMIT} words per page.`
    );
  }
  const result = await findAll({ term: q ?? undefined, letter, after, pageSize: limit });
  // A cursor lands on the page that holds it; one outside this result list is a mistake.
  if (after && !result.items.some((word) => word.id === after)) {
    return problem(
      400,
      "invalid_cursor",
      `"${after}" is not the id of a word in this result list.`,
      "Use the next or previous URL of an earlier response, or omit after for the first page."
    );
  }

  const pageUrl = (cursor: string | null) => {
    const link = new URL("/api/words", SITE_URL);
    if (q) link.searchParams.set("q", q);
    if (letter) link.searchParams.set("letter", letter);
    if (limitParam !== null) link.searchParams.set("limit", String(limit));
    if (cursor) link.searchParams.set("after", cursor);
    return link.toString();
  };

  return ok({
    total: result.total,
    page: result.currentPage,
    totalPages: result.totalPages,
    approximate: result.approximate,
    items: result.items.map(toApiWord),
    next: result.nextAfter ? pageUrl(result.nextAfter) : null,
    previous: result.currentPage > 1 ? pageUrl(result.prevAfter) : null,
  });
});

export const OPTIONS = preflight;
export const fallback = methodNotAllowed;
