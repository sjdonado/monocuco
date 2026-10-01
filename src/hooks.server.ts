import type { Handle } from "@sveltejs/kit";
import { building } from "$app/environment";
import { findById } from "$lib/server/dictionary";
import { problem } from "$lib/server/api";
import { homeMarkdown, prefers, prefersMarkdown } from "$lib/server/markdown";

// The home page answers in Markdown to clients that ask for it (`Accept: text/markdown`) and
// in HTML otherwise; both say `Vary: Accept` so caches keep them apart.
export const handle: Handle = async ({ event, resolve }) => {
  // A client that asks for JSON gets JSON for an unknown address too, not the HTML 404.
  if (
    !building &&
    !event.route.id &&
    prefers(event.request.headers.get("accept"), "application/json")
  ) {
    return problem(
      404,
      "not_found",
      `Nothing is published at ${event.url.pathname}.`,
      "The API is GET /api/words and GET /api/words/{id}; see /openapi.json.",
      { vary: "Accept" }
    );
  }

  // The prerender crawler follows links to /, where the query may not be read while building.
  if (building || event.url.pathname !== "/" || event.isDataRequest) return resolve(event);

  if (prefersMarkdown(event.request.headers.get("accept"))) {
    const { status, body } = await homeMarkdown(event.url);
    return new Response(event.request.method === "HEAD" ? null : body, {
      status,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        vary: "Accept",
        // No cache-control: the adapter's worker would store the response in the edge cache
        // under the URL alone (the cache ignores Vary), and serve Markdown to browsers.
      },
    });
  }

  const response = await resolve(event);
  response.headers.append("vary", "Accept");
  // A link to a word that does not exist shows "Palabra no encontrada" with a 404, as the
  // Markdown version and the API do, so it is never indexed as a page.
  const wordId = event.url.searchParams.get("word")?.trim();
  if (wordId && response.status === 200 && !(await findById(wordId))) {
    return new Response(response.body, { status: 404, headers: response.headers });
  }
  return response;
};
