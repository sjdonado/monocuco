import { redirect } from "@sveltejs/kit";

// Merged into /about; old links land on the same section with a permanent redirect. Answered by
// the worker: prerendering it would make the crawler write a page for the "#section" target.

export const load = () => {
  redirect(308, "/about#contacto");
};
