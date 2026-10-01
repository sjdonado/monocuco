// Shared by the /api routes: JSON responses and RFC 9457 problem details for every error.
import { json, type RequestEvent, type RequestHandler } from "@sveltejs/kit";
import { SITE_URL, wordPath } from "$lib/site";
import type { Word } from "$lib/server/dictionary";

const TITLES: Record<number, string> = {
  400: "Bad Request",
  404: "Not Found",
  405: "Method Not Allowed",
  500: "Internal Server Error",
};

const HEADERS = {
  "access-control-allow-origin": "*",
  // Short, because the adapter keeps these in the edge cache, which a deploy does not purge.
  "cache-control": "public, max-age=60",
};

export const ok = (body: unknown) => json(body, { headers: HEADERS });

/** An error an agent can act on: a stable `code`, what went wrong and how to fix the request. */
export const problem = (
  status: number,
  code: string,
  detail: string,
  hint: string,
  headers: Record<string, string> = {}
) =>
  json(
    { type: "about:blank", title: TITLES[status], status, code, detail, hint },
    {
      status,
      headers: {
        ...HEADERS,
        "cache-control": "no-store",
        "content-type": "application/problem+json",
        ...headers,
      },
    }
  );

export const methodNotAllowed: RequestHandler = ({ request }) =>
  problem(
    405,
    "method_not_allowed",
    `${request.method} is not supported here.`,
    "The API is read-only: use GET.",
    { allow: "GET, HEAD, OPTIONS" }
  );

/** CORS preflight: any origin may read the API from a browser. */
export const preflight: RequestHandler = () =>
  new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET",
      "access-control-allow-headers": "*",
      "access-control-max-age": "86400",
    },
  });

/** Unexpected failures still answer in JSON. */
export const guarded =
  <E extends RequestEvent>(handler: (event: E) => Promise<Response>) =>
  async (event: E) => {
    try {
      return await handler(event);
    } catch (error) {
      console.error("[api]", error);
      return problem(
        500,
        "internal_error",
        "The server could not answer this request.",
        "Retry later. If it keeps failing, report it at https://github.com/sjdonado/monocuco/issues."
      );
    }
  };

/** A word as the API returns it: the published entry plus the address of its page. */
export const toApiWord = (word: Word) => ({
  id: word.id,
  word: word.word,
  definition: word.definition,
  example: word.example,
  createdBy: word.createdBy,
  createdAt: word.createdAt,
  url: `${SITE_URL}${wordPath(word.id)}`,
});
