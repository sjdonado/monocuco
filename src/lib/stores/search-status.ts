import { writable } from "svelte/store";

/**
 * Store to track search initialization errors.
 * Components can disable search UI when the index fails to load.
 */
export const searchFailed = writable(false);
export const searchError = writable<string | null>(null);
