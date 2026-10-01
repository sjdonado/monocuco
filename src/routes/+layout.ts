// Every page is rendered to HTML (prerendered where it never changes, by the worker for the
// home page and its states), then hydrated: readers without JavaScript and crawlers get the
// words, and the browser takes over from there.
export const prerender = false;
