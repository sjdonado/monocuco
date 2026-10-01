# Monocuco

Open, free dictionary of Barranquilla Spanish (Español barranquillero), served at https://monocuco.sjdonado.com. The UI copy is Spanish; keep it Spanish. LICENSE is MIT and the README invites contributions, so "open source" is an accurate claim here.

The app is a SvelteKit site whose search runs in the browser: the browser downloads the whole dataset and a prebuilt MiniSearch index and searches locally. The Cloudflare worker renders the home page and its states to HTML (so readers without JavaScript, crawlers and agents get the words), answers `Accept: text/markdown` on `/`, and serves a read-only JSON API under `/api` (`static/openapi.json`, `static/llms.txt`). New words arrive only through the CLI (`bun run add-word`) and a pull request. The web submission form (`/add`) was removed because production never had its webhook configured (the live `/_app/env.js` is `{}`).

## Stack

- **Framework**: SvelteKit 2 with Svelte 5 runes, server-rendered then hydrated. `/` is rendered by the worker on each request (`src/routes/+layout.server.ts`); `/about`, `/privacy` and `/sitemap.xml` are prerendered; `/guidelines` and `/contact` redirect (308, from the worker) to sections of `/about`
- **Hosting**: Cloudflare Pages through `@sveltejs/adapter-cloudflare` (`wrangler.toml`)
- **Styling**: TailwindCSS 4 with DaisyUI 5 and `@tailwindcss/typography`. `src/app.css` is the only place design tokens live: both themes (`light`, `dark` with `prefersdark`, chosen by the OS), the one accent, the self-hosted Inter font (`static/fonts/`), the shared utilities `text-muted`, `border-hairline` and `prose-tokens`, and the global focus ring. The rules every page follows are the design-system spec, `openspec/specs/design-system/spec.md`; the reasoning behind them is in `openspec/changes/archive/2026-10-01-revamp-minimalist-design/design.md`
- **Search**: MiniSearch, index built at data time by `scripts/build-index.ts`, loaded client-side by `src/lib/db/repository.ts`
- **Offline**: a service worker (`src/service-worker.ts`) precaches the build and static files; it is registered only outside dev
- **Tooling**: Bun only, no Node. Bun installs (`bun.lock`), runs the repository scripts (`scripts/*.ts` start with `#!/usr/bin/env bun`) and every `package.json` script. The tools whose entries are Node scripts (Vite, Vitest, ESLint, Prettier, svelte-check, wrangler) run as `bun --bun <tool>`. Verified on 2026-10-01 by running `bun run ci` and `build-data` with a `node` on PATH that fails when called. TypeScript stays on 6: svelte-check does not support TypeScript 7 yet

## Layout

```
data.json                        # Source of truth for dictionary entries, edited by add-word
scripts/add-word.ts              # CLI: append an entry to data.json and the README contributor table
scripts/build-index.ts           # data.json -> static/data.json (normalized, sorted) + static/search-index.json
scripts/generate-initial-words.ts# static/data.json -> src/lib/data/initial-words.json (prerendered first page)
src/app.css                      # Design tokens: both themes, font, shared utilities, focus ring
src/app.html                     # Document shell, meta tags, theme-color
src/lib/db/repository.ts         # initDB, findAll (browse, letter, search, cursor pagination), findSuggestions, findById, getLetterCounts, firstLetter
src/lib/components/              # SearchInput (combobox), WordCard (entry row; h1 headword on a word page, h2 in lists), LetterNav (letter row)
src/lib/stores/search-status.ts  # searchFailed / searchError, shared by the search UI
src/routes/+layout.svelte        # Sticky header (logo, search) on every page, footer, SW registration
src/routes/+page.svelte          # Home: count label, letter row and list; letter (?letter=), search results (?q=), word detail (?word=), pagination (?after=)
src/routes/+layout.server.ts     # Server render of the home states (not ?q=) for the first page view only: untracked, so no browser navigation calls the worker
src/hooks.server.ts              # Markdown for `Accept: text/markdown` on /, and Vary: Accept
src/lib/server/                  # dictionary (the data bundled in the worker), markdown (the Markdown home), api (problem+json helpers)
src/lib/site.ts                  # Site URL, canonical paths, plain text for meta tags
src/routes/api/                  # GET /api/words, GET /api/words/{id}, JSON 404 for any other /api path
src/routes/sitemap.xml/          # Prerendered sitemap: pages, letters, every word
src/routes/{about,privacy}/       # About (with the content guidelines and how to contribute) and privacy, prerendered
src/routes/{guidelines,contact}/ # Old addresses: permanent redirects to /about#pautas and /about#contacto
static/                          # Generated data.json and search-index.json, icons, manifest, robots.txt, llms.txt, openapi.json
```

## Commands

Run from the repository root. Install with `bun install`.

```sh
bun run dev          # Vite dev server
bun run ci           # The whole local ladder below, in order
bun run check        # svelte-kit sync + svelte-check (types)
bun run lint         # eslint . && prettier --check .
bun run format       # prettier --write .
bun run test         # Vitest, both projects, single run
bun run build        # Production build into .svelte-kit/
bun run build-data   # Regenerate static/data.json, static/search-index.json, src/lib/data/initial-words.json
bun run add-word --word "..." --definition "..." [--example "..."] --author "..." [--website "..."]
bun run deploy       # vite build && wrangler pages deploy (publishes to production)
```

## Verification

"Done" is `bun run ci` exiting 0, then the browser pass below for any change a visitor can see or a client can call. `ci` runs, cheapest first, each rung only if the previous one passed:

1. `check`: svelte-check for the app, and `tsc -p scripts/tsconfig.json` (strict) for the scripts.
2. `lint`: ESLint, then Prettier in check mode. Prettier ignores `*.json`, `*.md` and `static/` (`.prettierignore`).
3. `test`: Vitest with two projects defined in `vite.config.ts`.
   - `unit` (Bun, through `bun --bun vitest`): `src/**/*.{test,spec}.{js,ts}`, excluding the `.svelte.` ones. `src/lib/db/repository.test.ts` covers init, browse pagination, search ranking, fuzzy fallback, suggestions, lookup, letter counts and init failure against the real published data. `src/lib/data/published-data.test.ts` fails when `data.json` and the generated files disagree (`bun run build-data` was not run), when the prebuilt first page or its pager differs from what the client computes, or when the index stores fields. `src/routes/api/api.test.ts` calls the API handlers and checks every error code against `static/openapi.json`; `src/lib/server/markdown.test.ts` covers Accept negotiation and the Markdown home.
   - `client` (Chromium through Playwright, always headless): `src/**/*.svelte.test.ts`, component tests with `vitest-browser-svelte`. `WordCard.svelte.test.ts` is the example to copy.

There is no remote CI beyond the Cloudflare Pages preview build on each pull request, and `bun run deploy` does not run the ladder first. When you change `repository.ts`, extend its test; when you change the API, update `static/openapi.json`, `static/llms.txt` and the API test together.

### Browser pass

The design and behavior rules are checked in a real browser by the agent making the change, with the browser MCP: `open` (Chromium, or WebKit for layout that may differ in Safari, with the viewport and color scheme), `network` and `console` for requests and errors, `performance` and `heap_snapshot` for memory, and `run` (Playwright code with `page` and `context`) for routing a request to fail, going offline, blocking third-party requests, key presses and measuring computed styles. The rules are the design-system spec (`openspec/specs/design-system/spec.md`). Serve the production build (`bun run build && bun run preview`), block third-party requests where the tool allows, and cover each item below that the change can affect. Report what was checked and its result; a check that was not run is reported as not run.

**States**, at 360 px and 1440 px wide, in the light and the dark theme: all words (`/`), page 2 (`/?after=<id>`), a letter (`/?letter=M`), a search (`/?q=carnaval`), an empty search (`/?q=zzqxjwv`), a word with and without `q`, a missing word (`/?word=nope`, a 404), search off (`data.json` answering 500 after focusing the search field), a failed search (`/?q=carnaval` with `data.json` failing), not found (`/add`), `/about` and `/privacy`.

**In every state**: no console errors, no failed same-origin requests, no horizontal scroll, exactly one `h1` that describes the page, a title of the form `Monocuco | …`, one meta description, `lang="es"`, and an absolute canonical link and `og:url` (no canonical on error pages). Word entries are rows (a top hairline, never a boxed card), and the result line is the first thing in the content column.

**Design measurements** (the thresholds the spec sets):

- Text contrast at least 4.5:1, 3:1 for text of 24 px or more (18.66 px bold); a field's border at least 3:1 against the surface around it.
- Tap targets at least 24 px on both axes (a `<label for>` is not a target, its field is); letters and page numbers at least 32 px; at 360 px the search field and the pagination buttons at least 40 px tall.
- No visible box shadows; at most one chromatic hue family on a screen (the accent) outside status messages and form validation.
- Font sizes only 12, 14, 16, 18, 24 or 30 px; radii only 6 px, 8 px or a pill; fonts only the self-hosted Inter, never a third-party font request.
- Tabbing through home, a search and `/about` (at 1440 and 360 px), every focus stop shows a ring of at least 3:1. Read `outline` two animation frames after the focus change (links and inputs transition it).
- The current letter (or "Todas") and the current page share one style: the hairline border and the raised background.

**Classes the design system bans in `.svelte` files** (review the diff for them): shadows (`shadow-*`); radii other than `rounded-field`, `rounded-box` or `rounded-full`; `text-xl` and `text-4xl` or larger; `font-bold`, `font-extrabold`, `font-black`; ad hoc opacity (`text-base-content/NN`, use `text-muted`); a second hue (`secondary`, `accent`, `neutral` on text, backgrounds, borders, buttons, badges or links); status alerts outside status messages (`alert-warning`, `alert-info`, `alert-success`); `dark:` overrides; raw palette colors (`gray-500` and the like); arbitrary px or viewport values (`[13px]`); skeletons; decorative emoji; bare `prose` without `prose-tokens`; removing the focus ring (`focus:outline-none`).

**Flows**, at both widths:

- Search, then Back to all words. A suggestion by mouse (focus stays in the field) and by keyboard (Down twice, Enter). The `Buscar "…"` option for a term with no suggestion, by mouse and keyboard, and no "Sin resultados". Up from no highlight wraps to the last suggestion. "Buscando..." while suggestions load.
- Paging: from the bottom of the list the new page opens at the top, "Página N de M" sits on the right of the result line, Back steps through pages, and keyboard focus stays in the pager.
- Letters: a letter, its page 2, back to "Todas", `?letter=é` showing E.
- Clearing the search returns to all words; accents fold ("aja" finds "ajá"); a missing word shows no pager and links back to all words; not found links home; a failed search shows the failure screen with "Reintentar".
- Keyboard in the suggestion list: Down from the last suggestion clears the highlight; "Anterior" to page 1 moves focus to the page number without scrolling.
- Search data on first use: a reader who loads a page, scrolls and goes from `/about` to all words downloads neither `data.json` nor `search-index.json` (check the network log, including the service worker's requests); the first focus on the search field downloads each once; focusing the pager starts the load, and if it fails the page keeps its words and shows the "La búsqueda no está disponible" notice; a letter page, then "Todas", then Back shows the letter's words again before the data loads.
- Offline, after one search online: `/?letter=M` opens.
- A search typed on `/about` never asks the server (no request for `/` or `__data.json`).

**Without a browser** (plain HTTP against the build, then against the Cloudflare preview of the pull request):

- Raw HTML of `/`, a letter, `/about` and `/privacy` has at least 500 characters of text in `<main>` (a word page: its word as the `h1` and its definition), one `h1`, sequential headings, canonical, `lang`, `og:type`, `og:image`, and JSON-LD (`WebSite` on lists, `DefinedTerm` on a word).
- `curl -sS -L -i -H 'Accept: text/markdown' <origin>/` answers `text/markdown` with `Vary: Accept` and no `Cache-Control`; `Accept: text/html` and `*/*` answer HTML with `Vary: Accept`.
- `/guidelines` and `/contact` answer 308 to `/about#pautas` and `/about#contacto`, and both ids exist on `/about`; every internal link on `/about` and `/privacy` resolves.
- `/sitemap.xml` lists every word and page and validates against the sitemaps.org schema; its URLs are all on the site with `&` escaped; `/robots.txt` names it; `/llms.txt` links `/openapi.json`, starts with an h1 and a summary, has its when-to-use text before the first H2, and every H2 section is a list of links.
- `/openapi.json` is OpenAPI 3.1.0, passes `bunx @redocly/cli lint`, and every documented endpoint answers as documented; every error is `application/problem+json` with a `code` from the document (including `POST /api/words`, 405 `method_not_allowed`, and an unknown path with `Accept: application/json`, 404 `not_found`); `OPTIONS /api/words` answers 204 with CORS.

## Data pipeline

`data.json` is the only file a contributor edits. Everything under `static/data.json`, `static/search-index.json` and `src/lib/data/initial-words.json` is generated by `bun run build-data` and committed, because `bun run deploy` runs `vite build` only and never regenerates them. `build-data` runs `build-index.ts` first and stops if it fails, because `generate-initial-words.ts` reads its output. Commit the regenerated files with the data change; the `published-data` test fails otherwise. `generate-initial-words.ts` writes a `generatedAt` timestamp, so every run touches that file.

## Traps

**Two entries can share a word.** `data.json` has duplicates such as "A la tiña". `build-index.ts` sorts with `compareWords` (`src/lib/text.js`: Spanish collation without leading punctuation, then a raw tiebreak), so ties are deterministic. `generate-initial-words.ts` must read that sorted output rather than sort again; a second comparator once swapped two different cards between the prerendered page and the loaded one. Cursors (`?after=`) are snapped to the page boundary, so links saved before an order change still land on a page.

**Pagination cursors are item ids.** `?after=<id>` is the id of the first item on the page, not the last item of the previous one. Page 2's "previous" link is `null`, which means the unparameterized first page.

**The repository module holds state.** `initDB()` caches both success and failure for the page's lifetime; after a failed load every query rejects until reload. Tests reload the module with `vi.resetModules()` to get a clean copy.

**Vite loads `.env` into tests and builds.** No code reads any variable from it any more: the analytics script (`PUBLIC_MODE`) and the web submission form (`PUBLIC_WORD_SUBMISSION_WEBHOOK`) were removed. The site collects no data itself, and `/privacy` says so; adding any tracking means updating that page in the same change.

**SvelteKit does not register the service worker.** `svelte.config.js` sets `serviceWorker.register: false`; `src/routes/+layout.svelte` registers it and handles the failures (offline, its update check cannot fetch the script). SvelteKit's own registration left those rejections unhandled.

**Playwright needs its own Chromium build.** The browser test project uses the `playwright` version pinned in `package.json`. After an install or upgrade, run `bunx playwright install chromium` if a run fails with "Executable doesn't exist".

**Prerendered pages never reach a hook.** The adapter's worker serves prerendered paths straight from the static assets (`node_modules/@sveltejs/adapter-cloudflare/files/worker.js`), so `src/hooks.server.ts` never runs for them; it runs for `/`, `/api` and every unknown path. That is why `/` is rendered per request: prerendering it again would silently drop Markdown negotiation. Prerendered pages may not read `url.searchParams`; `canonicalPath` reads the query only on `/`.

**The worker loads the data, not the index, for pages.** Parsing `static/data.json` costs about 2 ms; loading the search index costs 12 to 38 ms, too much for every page on Cloudflare's CPU limits. So the server renders `?q=` as pending (the browser searches), and only `/api/words?q=` and the Markdown `?q=` call `ensureIndex()`, once per worker instance.

**Text rules live in one module.** `src/lib/text.js` holds `firstLetter` (a word is under its first letter after leading punctuation, without accents, with Ñ as its own letter), `compareWords` (Spanish dictionary order) and `processTerm` (accent folding for the search index and every query). `scripts/build-index.ts`, `scripts/generate-initial-words.ts` and `src/lib/db/repository.ts` all import it; change a rule there and run `bun run build-data`, or the published index and the client disagree. Search requires every query word (AND) and falls back to typo-tolerant matching only when nothing matches, marking those results approximate. `/?q=A` is a text search, not a letter; the letter row links to `/?letter=A`.

**DaisyUI rules sit in nested cascade layers.** The built CSS puts DaisyUI in `@layer utilities` sublayers (`utilities/daisyui.l1...`), so a Tailwind utility or an `@utility` rule, which sits directly in `utilities`, beats any DaisyUI component class, and unlayered CSS beats both. That is why the focus ring in `src/app.css` is unlayered and the shared classes are `@utility`. Confirm the computed style in the browser before relying on a new rule.

**Visual changes must refresh the README screenshot.** When the header, search, word card, letter row or pagination look different, follow `docs/MEDIA.md` and commit the image with the change.
