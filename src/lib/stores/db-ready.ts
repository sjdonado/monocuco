import { writable } from "svelte/store";

/**
 * Store to track database readiness state
 * This allows components like SearchInput and LetterNav to show loading states
 * while the database is initializing in the background
 */
export const dbReady = writable(false);
export const dbInitializing = writable(false);
