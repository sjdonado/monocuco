# Monocuco

Open, free dictionary of Barranquilla Spanish (Español barranquillero), served at https://monocuco.sjdonado.com. The UI copy is Spanish; keep it Spanish. LICENSE is MIT and the README invites contributions, so "open source" is an accurate claim here.

The app is a SvelteKit site whose search runs in the browser: the browser downloads the whole dataset and a prebuilt MiniSearch index and searches locally. The Cloudflare worker renders the home page and its states to HTML (so readers without JavaScript, crawlers and agents get the words), answers `Accept: text/markdown` on `/`, and serves a read-only JSON API under `/api` (`static/openapi.json`, `static/llms.txt`). New words arrive only through the CLI (`bun run add-word`) and a pull request. The web submission form (`/add`) was removed because production never had its webhook configured (the live `/_app/env.js` is `{}`).

## Stack

- **Framework**: SvelteKit 2 with Svelte 5 runes, server-rendered then hydrated. `/` is rendered by the worker on each request (`src/routes/+layout.server.ts`); `/guidelines`, `/about`, `/contact`, `/privacy` and `/sitemap.xml` are prerendered
- **Hosting**: Cloudflare Pages through `@sveltejs/adapter-cloudflare` (`wrangler.toml`)
- **Styling**: TailwindCSS 4 with DaisyUI 5 and `@tailwindcss/typography`. `src/app.css` is the only place design tokens live: both themes (`light`, `dark` with `prefersdark`, chosen by the OS), the one accent, the self-hosted Inter font (`static/fonts/`), the shared utilities `text-muted`, `border-hairline` and `prose-tokens`, and the global focus ring. The rules every page follows are the design-system spec, `openspec/specs/design-system/spec.md`; the reasoning behind them is in `openspec/changes/archive/2026-10-01-revamp-minimalist-design/design.md`
- **Search**: MiniSearch, index built at data time by `scripts/build-index.js`, loaded client-side by `src/lib/db/repository.ts`
- **Offline**: a service worker (`src/service-worker.ts`) precaches the build and static files; it is registered only outside dev
- **Tooling**: Bun for scripts and installs (`bun.lock`); the chained `package.json` scripts call `npm run`, so `npm` (it ships with Node) must be on PATH

## Layout

```
data.json                        # Source of truth for dictionary entries, edited by add-word
scripts/add-word.js              # CLI: append an entry to data.json and the README contributor table
scripts/build-index.js           # data.json -> static/data.json (normalized, sorted) + static/search-index.json
scripts/generate-initial-words.js# static/data.json -> src/lib/data/initial-words.json (prerendered first page)
scripts/ui-audit.js              # Browser audit of the production build (see Verification)
scripts/design-lint.js           # Banned class patterns in .svelte files (run by lint)
scripts/capture-media.js         # Regenerates the README screenshots (docs/MEDIA.md)
scripts/lib/app-states.js        # Preview server and page states shared by the audit and media scripts
src/app.css                      # Design tokens: both themes, font, shared utilities, focus ring
src/app.html                     # Document shell, meta tags, theme-color
src/lib/db/repository.ts         # initDB, findAll (browse, letter, search, cursor pagination), findSuggestions, findById, getLetterCounts, firstLetter
src/lib/components/              # SearchInput (combobox), WordCard (entry row; h1 headword on a word page, h2 in lists), LetterNav (letter row)
src/lib/stores/search-status.ts  # searchFailed / searchError, shared by the search UI
src/routes/+layout.svelte        # Sticky header (logo, search) on every page, footer, SW registration, analytics
src/routes/+page.svelte          # Home: count label, letter row and list; letter (?letter=), search results (?q=), word detail (?word=), pagination (?after=)
src/routes/+layout.server.ts     # Server render of the home states (not ?q=) for the first page view only: untracked, so no browser navigation calls the worker
src/hooks.server.ts              # Markdown for `Accept: text/markdown` on /, and Vary: Accept
src/lib/server/                  # dictionary (the data bundled in the worker), markdown (the Markdown home), api (problem+json helpers)
src/lib/site.ts                  # Site URL, canonical paths, plain text for meta tags
src/routes/api/                  # GET /api/words, GET /api/words/{id}, JSON 404 for any other /api path
src/routes/sitemap.xml/          # Prerendered sitemap: pages, letters, every word
src/routes/{about,contact,privacy}/ # Trust pages (prerendered)
src/routes/guidelines/           # Content guidelines
static/                          # Generated data.json and search-index.json, icons, manifest, robots.txt, llms.txt, openapi.json
```

## Commands

Run from the repository root. Install with `bun install`.

```sh
bun run dev          # Vite dev server
bun run ci           # The whole local ladder below, in order
bun run check        # svelte-kit sync + svelte-check (types)
bun run lint         # eslint . && prettier --check . && the design lint
bun run format       # prettier --write .
bun run test         # Vitest, both projects, single run
bun run build        # Production build into .svelte-kit/
bun run audit:ui     # Build, then the browser audit; add -- --strict to enforce design rules (ci does)
bun run media        # Build, then regenerate docs/media/*.webp (docs/MEDIA.md)
bun run build-data   # Regenerate static/data.json, static/search-index.json, src/lib/data/initial-words.json
bun run add-word -- --word "..." --definition "..." [--example "..."] --author "..." [--website "..."]
bun run deploy       # vite build && wrangler pages deploy (publishes to production)
```

## Verification

"Done" is `bun run ci` exiting 0. It runs, cheapest first, each rung only if the previous one passed:

1. `check`: types, via svelte-check. Verified green on 2026-09-30.
2. `lint`: ESLint, Prettier in check mode, then `scripts/design-lint.js`, which fails on class patterns the design system bans in `.svelte` files (shadows, off-scale radii and sizes, `font-bold`, `text-base-content/NN`, a second hue, status alerts, `dark:`, raw palette colors, arbitrary px or viewport values, bare `prose`, removing the focus ring, decorative emoji). Each finding names the token to use instead. Prettier ignores `*.json`, `*.md` and `static/` (`.prettierignore`). Verified green.
3. `test`: Vitest with two projects defined in `vite.config.ts`. Verified green.
   - `unit` (Node): `src/**/*.{test,spec}.{js,ts}`, excluding the `.svelte.` ones. `src/lib/db/repository.test.ts` covers init, browse pagination, search ranking, fuzzy fallback, suggestions, lookup, letter counts and init failure against the real published data. `src/lib/data/published-data.test.ts` fails when an entry's id, word or definition in `data.json` differs from `static/data.json` (that is, `bun run build-data` was not run), or when the prerendered first page differs from the first page the client loads.
   - `client` (Chromium through Playwright, always headless): `src/**/*.svelte.test.ts`, component tests with `vitest-browser-svelte`. `WordCard.svelte.test.ts` is the example to copy.
   - `src/routes/api/api.test.ts` calls the API handlers directly and checks every error code against `static/openapi.json`; `src/lib/server/markdown.test.ts` covers Accept negotiation and the Markdown home.
4. `audit:ui -- --strict`: `vite build`, then `scripts/ui-audit.js` serves the build with `vite preview` on port 4179 and opens every page and state (home, page 2, a letter, search, empty search, a word with and without `q`, data failure, not found, `/guidelines`) at 360 px and 1440 px in light and dark, with third-party requests blocked. Verified green, about 50 s.
   - **Machine-readable checks** (`scripts/lib/machine-checks.js`) run first over plain HTTP and are hard checks: raw HTML of `/`, a word, a letter and the content pages has the content, one h1, sequential headings, canonical, `lang`, `og:type`, `og:image` and JSON-LD; `Accept: text/markdown` on `/` gets Markdown with `Vary: Accept` and browsers get HTML; the sitemap lists every word; robots.txt names it; llms.txt has its when-to-use section; every documented API endpoint answers, and every error is `application/problem+json` with a code from the OpenAPI document.
   - **Hard checks** always fail the run: console errors, page errors, same-origin 4xx/5xx or failed requests, horizontal scroll, a page that never reaches its named state (each entry in `PAGES` waits until the page has hydrated and the browser has loaded the search data, then for exactly the expected cards, because the server's HTML already has them), and every flow in `auditFlows` (search, suggestions by mouse and keyboard, pending suggestions, letters, paging and history, clearing the search, accents, missing word, not-found). The `data-failure` state runs in its own context with the service worker blocked, because a worker from an earlier page would serve cached data.
   - **Design checks** fail the run with `--strict`, which `ci` passes: text contrast (4.5:1, 3:1 for large text), tap targets under 24 px (a `<label for>` is not a target; its field is), the search field and pagination buttons under 40 px tall at 360 px, visible box shadows, more than one chromatic hue family outside status messages and form validation, font sizes off the 12/14/16/18/24/30 scale, radii other than 6 px, 8 px or a pill, more or fewer than one `h1`, a keyboard focus stop on home, a search or `/guidelines` (at 1440 and 360 px) without a visible ring of at least 3:1, and third-party font requests. The thresholds are the `DESIGN` object at the top of the script and must match the design-system spec. Without `--strict` they are only reported, which is useful while a visual change is in progress.
   - Output: `.svelte-kit/ui-audit/report.json` (every measurement, including radii, font sizes and families per page) and a full-page screenshot per page, width and scheme. Look at the screenshots after any visual change. `--only=<page>` narrows the run, `--no-build` reuses the last build.

There is no remote CI: no `.github/workflows`, so nothing runs on a pull request unless it is added. `bun run deploy` does not run the ladder first.

When you add a page, a route state or a flow, add it to `PAGES` or `auditFlows` in `scripts/ui-audit.js` in the same change. When you change the API, update `static/openapi.json` and `static/llms.txt` with it; the API test fails on an error code the document does not list. When you change `repository.ts`, extend its test.

## Data pipeline

`data.json` is the only file a contributor edits. Everything under `static/data.json`, `static/search-index.json` and `src/lib/data/initial-words.json` is generated by `bun run build-data` and committed, because `bun run deploy` runs `vite build` only and never regenerates them. `build-data` runs `build-index.js` first and stops if it fails, because `generate-initial-words.js` reads its output. Commit the regenerated files with the data change; the `published-data` test fails otherwise. `generate-initial-words.js` writes a `generatedAt` timestamp, so every run touches that file.

## Traps

**Two entries can share a word.** `data.json` has duplicates such as "A la tiña". `build-index.js` sorts with `compareWords` (`src/lib/text.js`: Spanish collation without leading punctuation, then a raw tiebreak), so ties are deterministic. `generate-initial-words.js` must read that sorted output rather than sort again; a second comparator once swapped two different cards between the prerendered page and the loaded one. Cursors (`?after=`) are snapped to the page boundary, so links saved before an order change still land on a page.

**Pagination cursors are item ids.** `?after=<id>` is the id of the first item on the page, not the last item of the previous one. Page 2's "previous" link is `null`, which means the unparameterized first page.

**The repository module holds state.** `initDB()` caches both success and failure for the page's lifetime; after a failed load every query rejects until reload. Tests reload the module with `vi.resetModules()` to get a clean copy.

**Vite loads `.env` into tests and builds.** `PUBLIC_MODE=production` adds the Umami analytics script. `PUBLIC_WORD_SUBMISSION_WEBHOOK` is no longer read by any code. The audit blocks every third-party request, so it never sends analytics or a submission.

**Playwright needs its own Chromium build.** The browser test project and the audit use the `playwright` version pinned in `package.json`. After an install or upgrade, run `bunx playwright install chromium` if a run fails with "Executable doesn't exist".

**Prerendered pages never reach a hook.** The adapter's worker serves prerendered paths straight from the static assets (`node_modules/@sveltejs/adapter-cloudflare/files/worker.js`), so `src/hooks.server.ts` never runs for them; it runs for `/`, `/api` and every unknown path. That is why `/` is rendered per request: prerendering it again would silently drop Markdown negotiation. Prerendered pages may not read `url.searchParams`; `canonicalPath` reads the query only on `/`.

**The worker loads the data, not the index, for pages.** Parsing `static/data.json` costs about 2 ms; loading the search index costs 12 to 38 ms, too much for every page on Cloudflare's CPU limits. So the server renders `?q=` as pending (the browser searches), and only `/api/words?q=` and the Markdown `?q=` call `ensureIndex()`, once per worker instance.

**Text rules live in one module.** `src/lib/text.js` holds `firstLetter` (a word is under its first letter after leading punctuation, without accents, with Ñ as its own letter), `compareWords` (Spanish dictionary order) and `processTerm` (accent folding for the search index and every query). `scripts/build-index.js`, `scripts/generate-initial-words.js` and `src/lib/db/repository.ts` all import it; change a rule there and run `bun run build-data`, or the published index and the client disagree. `scripts/lib/app-states.js` mirrors `firstLetter` inside browser checks. Search requires every query word (AND) and falls back to typo-tolerant matching only when nothing matches, marking those results approximate. `/?q=A` is a text search, not a letter; the letter row links to `/?letter=A`.

**DaisyUI rules sit in nested cascade layers.** The built CSS puts DaisyUI in `@layer utilities` sublayers (`utilities/daisyui.l1...`), so a Tailwind utility or an `@utility` rule, which sits directly in `utilities`, beats any DaisyUI component class, and unlayered CSS beats both. That is why the focus ring in `src/app.css` is unlayered and the shared classes are `@utility`. Confirm the computed style in the audit report before relying on a new rule.

**Links and inputs transition their outline.** Reading `outline` in the same frame as a focus change returns the start of the transition (0 px). The audit's focus pass waits two animation frames; do the same in any new check.

**Visual changes must refresh the README screenshots.** Run `bun run media` when the header, search, word card, letter navigation or pagination look different, and commit the images with the change (`docs/MEDIA.md`).
