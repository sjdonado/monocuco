import { writable } from "svelte/store";
import { initDB } from "$lib/db/repository";

/**
 * Store to track search initialization errors.
 * Components can disable search UI when the index fails to load.
 */
export const searchFailed = writable(false);
export const searchError = writable<string | null>(null);
/** True once the words and the index are loaded in the browser. */
export const searchReady = writable(false);

let started = false;

/**
 * Loads the search data the first time a visitor shows they need it: focusing the search
 * field, reaching for the pager or the letters, or opening a state the server did not render.
 * A visitor who only reads the server's page never downloads or holds it (about 30 MB of
 * renderer memory).
 */
export const warmSearch = () => {
  if (started || typeof window === "undefined") return;
  started = true;
  initDB()
    .then(() => {
      searchReady.set(true);
      // The audit waits for this before checking a state the browser computed.
      document.documentElement.dataset.searchReady = "";
    })
    .catch((err) => {
      console.error("[Page] Search data initialization failed:", err);
      searchError.set(
        "No pudimos cargar los datos de búsqueda locales. Intenta de nuevo más tarde."
      );
      searchFailed.set(true);
    });
};
