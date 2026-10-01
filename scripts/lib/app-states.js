/**
 * Shared by scripts/ui-audit.js and scripts/capture-media.js: the preview server,
 * a browser context that blocks third-party requests, and the app's page states
 * with waits that only pass once the client shows that state.
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { firstLetter } from "../../src/lib/text.js";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const VITE = resolve(ROOT, "node_modules/.bin/vite");
export const PORT = 4179;
export const ORIGIN = `http://localhost:${PORT}`;

export const words = JSON.parse(readFileSync(resolve(ROOT, "static/data.json"), "utf-8"));
export const sample = words[Math.floor(words.length / 2)];

// `ready` waits for content that only the named state shows, once the page has hydrated. A
// search also waits for the browser's own search data (`data-search-ready`), which loads on
// first use; the other states are rendered by the server, and after a navigation in the
// browser their cards only match once the client has computed them.

// The page shows exactly the dataset entries `start..start+12`, and the numbered page
// links mark the current page.
export const cardsAre = (start) => (page) =>
  page.waitForFunction(
    (expected) => {
      if (!("hydrated" in document.documentElement.dataset)) return false;
      if (!document.querySelector("button[aria-current=page]")) return false;
      const shown = [...document.querySelectorAll("article h2")].map((h) => h.textContent?.trim());
      return JSON.stringify(shown) === JSON.stringify(expected);
    },
    words.slice(start, start + 12).map((w) => w.word)
  );

// The result count line renders only once `findAll(term)` resolved, and every card matches.
export const searchShows = (term) => (page) =>
  page.waitForFunction((t) => {
    if (!("searchReady" in document.documentElement.dataset)) return false;
    const count = [...document.querySelectorAll("p[aria-live]")].some((el) =>
      /^\d+ palabras? (encontradas? para|parecidas? a) /.test(
        el.textContent?.replace(/\s+/g, " ").trim() ?? ""
      )
    );
    const fold = (text) => text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    const cards = [...document.querySelectorAll("article")];
    return (
      count && cards.length > 0 && cards.every((c) => fold(c.textContent ?? "").includes(fold(t)))
    );
  }, term);

// The letter view's count line, then only words filed under the letter (checked with the
// app's own `firstLetter`, not a copy).
export const letterShows = (letter) => async (page) => {
  await page.waitForFunction(() => {
    if (!("hydrated" in document.documentElement.dataset)) return false;
    const count = [...document.querySelectorAll("p[aria-live]")].some((el) =>
      /^\d+ palabras? encontradas? con /.test(el.textContent?.replace(/\s+/g, " ").trim() ?? "")
    );
    return count && document.querySelectorAll("article h2").length > 0;
  });
  const heads = await page.locator("article h2").allInnerTexts();
  const wrong = heads.filter((w) => firstLetter(w) !== letter);
  if (wrong.length) throw new Error(`under ${letter} but filed elsewhere: ${wrong.join(", ")}`);
};

export const filedUnder = firstLetter;

export const wordShows = (word) => (page) =>
  page.waitForFunction(
    (w) => {
      if (!("hydrated" in document.documentElement.dataset)) return false;
      const cards = document.querySelectorAll("article");
      return cards.length === 1 && cards[0].querySelector("h1, h2")?.textContent?.trim() === w;
    },
    word,
    { timeout: 10_000 }
  );

// The welcome screen: the first page of words and the letter row (both need the data).
export const welcomeShows = async (page) => {
  await cardsAre(0)(page);
  await page.locator('nav[aria-label="Navegación por letras"] li').first().waitFor();
};

export const PAGES = [
  { name: "home", path: "/", ready: welcomeShows },
  { name: "page-2", path: `/?after=${encodeURIComponent(words[12].id)}`, ready: cardsAre(12) },
  { name: "search", path: "/?q=carnaval", ready: searchShows("carnaval") },
  {
    name: "search-empty",
    path: "/?q=zzqxjwv",
    ready: (page) => page.getByText("No encontramos palabras para esta búsqueda.").waitFor(),
  },
  {
    name: "word",
    path: `/?word=${encodeURIComponent(sample.id)}&q=${encodeURIComponent(sample.word)}`,
    ready: wordShows(sample.word),
  },
  { name: "letter", path: "/?letter=M", ready: letterShows("M") },
  {
    // An old or hand-made word link without `q`: the page names the word itself.
    name: "word-bare",
    path: `/?word=${encodeURIComponent(sample.id)}`,
    ready: wordShows(sample.word),
  },
  {
    // The search data fails: the page says so and offers a retry. A search, because the
    // search data loads on first use and the home page alone never asks for it.
    name: "data-failure",
    path: "/?q=carnaval",
    // Its own context with the service worker blocked: a worker from an earlier page
    // would serve the cached data and the failure would never happen.
    isolated: true,
    setup: (page) => page.route("**/data.json", (route) => route.fulfill({ status: 500 })),
    allowStatus: [500],
    allowConsole: [/Failed to init search data/, /Search data initialization failed/],
    allowRequestFailed: [/\/data\.json$/],
    ready: (page) => page.getByRole("button", { name: "Reintentar" }).waitFor(),
  },
  {
    // Unknown paths, including the removed /add, render the app's own not-found page.
    name: "not-found",
    path: "/add",
    allowStatus: [404],
    ready: (page) => page.getByRole("heading", { name: "Página no encontrada" }).waitFor(),
  },
  {
    name: "about",
    path: "/about",
    ready: (page) => page.getByRole("heading", { level: 1, name: "Acerca de Monocuco" }).waitFor(),
  },
  {
    name: "contact",
    path: "/contact",
    ready: (page) => page.getByRole("heading", { level: 1, name: "Contacto" }).waitFor(),
  },
  {
    name: "privacy",
    path: "/privacy",
    ready: (page) => page.getByRole("heading", { level: 1, name: "Privacidad" }).waitFor(),
  },
  {
    name: "guidelines",
    path: "/guidelines",
    ready: (page) => page.getByRole("heading", { name: "Pautas de contenido" }).waitFor(),
  },
];

/** Serves the last production build. Fails if something else already owns the port. */
export async function startPreview() {
  // A server already on the port would be audited instead of this build.
  const busy = await fetch(ORIGIN).then(
    () => true,
    () => false
  );
  if (busy) throw new Error(`port ${PORT} is already in use; stop that server first`);
  const child = spawn(VITE, ["preview", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`vite preview exited:\n${output}`);
    try {
      const res = await fetch(ORIGIN);
      if (res.ok) return child;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error(`vite preview did not answer on ${ORIGIN}:\n${output}`);
}

/** A browser context for one viewport and color scheme, offline except for the app. */
export async function newContext(browser, viewport, scheme, extra = {}) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    colorScheme: scheme,
    reducedMotion: "reduce",
    locale: "es-CO",
    ...extra,
  });
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN) || url.startsWith("data:")) return route.continue();
    return route.abort("blockedbyclient");
  });
  return context;
}
