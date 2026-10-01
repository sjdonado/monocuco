import { findById } from "$lib/server/dictionary";
import { guarded, methodNotAllowed, ok, preflight, problem, toApiWord } from "$lib/server/api";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = guarded(async ({ params }) => {
  const word = await findById(params.id);
  if (!word) {
    return problem(
      404,
      "word_not_found",
      `No word has the id "${params.id}".`,
      "Find the word and its id with GET /api/words?q=<word>."
    );
  }
  return ok(toApiWord(word));
});

export const OPTIONS = preflight;
export const fallback = methodNotAllowed;
