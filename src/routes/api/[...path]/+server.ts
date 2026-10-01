import { problem } from "$lib/server/api";
import type { RequestHandler } from "./$types";

// Any other address under /api answers in JSON too, never with the HTML error page.
export const fallback: RequestHandler = ({ url }) =>
  problem(
    404,
    "not_found",
    `Nothing is published at ${url.pathname}.`,
    "The endpoints are GET /api/words and GET /api/words/{id}; see /openapi.json."
  );
