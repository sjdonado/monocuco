# Monocuco

Open, free dictionary of Barranquilla Spanish (Español barranquillero), served at https://monocuco.sjdonado.com. The UI copy is Spanish; keep it Spanish. LICENSE is MIT and the README invites contributions, so "open source" is an accurate claim here.

The app is a static SvelteKit site with no server of its own: the browser downloads the whole dataset and a prebuilt MiniSearch index and searches locally. New words arrive through the CLI (`bun run add-word`) or the `/add` form, which posts to an external webhook for manual review.

## Stack

- **Framework**: SvelteKit 2 with Svelte 5 runes, `ssr = false` for every route (`src/routes/+layout.ts`); `/`, `/add` and `/guidelines` are prerendered
- **Hosting**: Cloudflare Pages through `@sveltejs/adapter-cloudflare` (`wrangler.toml`)
- **Styling**: TailwindCSS 4 with DaisyUI 5 and `@tailwindcss/typography`; the two themes (`light`, `dark` with `prefersdark`) live in `src/app.css`
- **Search**: MiniSearch, index built at data time by `scripts/build-index.js`, loaded client-side by `src/lib/db/repository.ts`
- **Forms**: TanStack Svelte Form + Zod (`src/routes/add/+page.svelte`)
- **Offline**: a service worker (`src/service-worker.ts`) precaches the build and static files; it is registered only outside dev
- **Tooling**: Bun for scripts and installs (`bun.lock`); the chained `package.json` scripts call `npm run`, so `npm` (it ships with Node) must be on PATH

## Layout

```
data.json                        # Source of truth for dictionary entries, edited by add-word
scripts/add-word.js              # CLI: append an entry to data.json and the README contributor table
scripts/build-index.js           # data.json -> static/data.json (normalized, sorted) + static/search-index.json
scripts/generate-initial-words.js# static/data.json -> src/lib/data/initial-words.json (prerendered first page)
scripts/ui-audit.js              # Browser audit of the production build (see Verification)
src/app.css                      # Tailwind entry, DaisyUI plugin and both theme token sets
src/app.html                     # Document shell, meta tags, theme-color
src/lib/db/repository.ts         # initDB, findAll (browse, search, cursor pagination), findSuggestions, findById, getLetterCounts
src/lib/components/              # SearchInput, WordCard, LetterNav, WordCardSkeleton (unused)
src/lib/stores/search-status.ts  # searchFailed / searchError, shared by the search UI
src/routes/+layout.svelte        # Header, mobile drawer, search, letter nav, footer, SW registration, analytics
src/routes/+page.svelte          # Home: browse, search results (?q=), word detail (?word=), pagination (?after=)
src/routes/add/                  # Submission form
src/routes/guidelines/           # Content guidelines
static/                          # Generated data.json and search-index.json, icons, manifest
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
bun run audit:ui     # Build, then the browser audit; add -- --strict to enforce design rules
bun run build-data   # Regenerate static/data.json, static/search-index.json, src/lib/data/initial-words.json
bun run add-word -- --word "..." --definition "..." [--example "..."] --author "..." [--website "..."]
bun run deploy       # vite build && wrangler pages deploy (publishes to production)
```

## Verification

"Done" is `bun run ci` exiting 0. It runs, cheapest first, each rung only if the previous one passed:

1. `check`: types, via svelte-check. Verified green on 2026-09-30.
2. `lint`: ESLint, then Prettier in check mode. Prettier ignores `*.json`, `*.md` and `static/` (`.prettierignore`). Verified green.
3. `test`: Vitest with two projects defined in `vite.config.ts`. Verified green.
   - `unit` (Node): `src/**/*.{test,spec}.{js,ts}`, excluding the `.svelte.` ones. `src/lib/db/repository.test.ts` covers init, browse pagination, search ranking, fuzzy fallback, suggestions, lookup, letter counts and init failure against the real published data. `src/lib/data/published-data.test.ts` fails when an entry's id, word or definition in `data.json` differs from `static/data.json` (that is, `bun run build-data` was not run), or when the prerendered first page differs from the first page the client loads.
   - `client` (Chromium through Playwright): `src/**/*.svelte.test.ts`, component tests with `vitest-browser-svelte`. `WordCard.svelte.test.ts` is the example to copy.
4. `audit:ui`: `vite build`, then `scripts/ui-audit.js` serves the build with `vite preview` on port 4179 and opens every page and state (home, page 2, search, empty search, word detail, `/add`, `/guidelines`) at 360 px and 1440 px in light and dark, with third-party requests blocked. Verified green, about 50 s.
   - **Hard checks** always fail the run: console errors, page errors, same-origin 4xx/5xx or failed requests, horizontal scroll, a page that never reaches its named state (each entry in `PAGES` waits until the client has loaded its own result and shows exactly the expected cards, because the prerendered home already has cards), and the flows search-submit, suggestion-select, pagination-next and add-form validation.
   - **Design checks** are reported and fail only with `--strict`: text contrast (4.5:1, 3:1 for large text), tap targets under 24 px, visible box shadows, more than one chromatic hue family per screen, third-party font requests. The thresholds are the `DESIGN` object at the top of the script; change them there when a design spec sets different numbers.
   - Output: `.svelte-kit/ui-audit/report.json` (every measurement, including radii, font sizes and families per page) and a full-page screenshot per page, width and scheme. Look at the screenshots after any visual change. `--only=<page>` narrows the run, `--no-build` reuses the last build.

There is no remote CI: no `.github/workflows`, so nothing runs on a pull request unless it is added. `bun run deploy` does not run the ladder first.

When you add a page, a route state or a flow, add it to `PAGES` or `auditFlows` in `scripts/ui-audit.js` in the same change. When you change `repository.ts`, extend its test.

## Data pipeline

`data.json` is the only file a contributor edits. Everything under `static/data.json`, `static/search-index.json` and `src/lib/data/initial-words.json` is generated by `bun run build-data` and committed, because `bun run deploy` runs `vite build` only and never regenerates them. `build-data` runs `build-index.js` first and stops if it fails, because `generate-initial-words.js` reads its output. Commit the regenerated files with the data change; the `published-data` test fails otherwise. `generate-initial-words.js` writes a `generatedAt` timestamp, so every run touches that file.

## Traps

**Two entries can share a word.** `data.json` has duplicates such as "A la tiña". `build-index.js` sorts by lowercase word with a stable sort, so ties keep source order. `generate-initial-words.js` must read that sorted output rather than sort again; a second comparator once swapped two different cards between the prerendered page and the loaded one.

**Pagination cursors are item ids.** `?after=<id>` is the id of the first item on the page, not the last item of the previous one. Page 2's "previous" link is `null`, which means the unparameterized first page.

**The repository module holds state.** `initDB()` caches both success and failure for the page's lifetime; after a failed load every query rejects until reload. Tests reload the module with `vi.resetModules()` to get a clean copy.

**Vite loads `.env` into tests and builds.** `PUBLIC_MODE=production` adds the Umami analytics script and `PUBLIC_WORD_SUBMISSION_WEBHOOK` is where `/add` posts. The audit blocks every third-party request, so it never sends analytics or a submission.

**Playwright needs its own Chromium build.** The browser test project and the audit use the `playwright` version pinned in `package.json`. After an install or upgrade, run `bunx playwright install chromium` if a run fails with "Executable doesn't exist".

**Playwright `fill()` does not trigger TanStack Form validation on `/add`.** Type with `pressSequentially()` to reproduce what a person does.

**DaisyUI rules sit in their own cascade layers.** The built CSS declares `@layer daisyui.*` next to Tailwind's `theme`, `base`, `components` and `utilities`, so which rule wins depends on layer order, not on source order or specificity. Before relying on a shared class of your own against a DaisyUI component class, confirm the computed style in the audit report or the browser.
