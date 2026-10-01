## Why

Monocuco has no single visual language. The two DaisyUI themes carry five chromatic families (carnival red primary, purple secondary, teal accent, and saturated success, warning, error and info), cards and the form use drop shadows, headings mix `text-3xl font-bold` with `text-2xl font-semibold`, secondary text uses five different opacities (`/50` to `/80`), and `/guidelines` colors its section headings green and red with decorative emoji. The browser audit merged in #97 measures the cost: in `--strict` mode it reports 28 distinct design issues. Examples: primary links at 4.03:1 in dark mode, the `/guidelines` headings at 1.96:1 and 2.86:1, letter navigation rows 20 px tall, pagination numbers 7 to 9 px wide, two hue families on `/guidelines` and on an empty search, and two `h1` elements on every page. The goal is for Monocuco to read like a calm, precise reference work, with Scandinavian restraint and Linear-grade precision. Every existing flow should give immediate, legible feedback, and every page should follow one minimal system. The change adds no features.

## What Changes

- Replace both DaisyUI themes with one Nordic token structure in a light and a dark variant, chosen by the operating system as today. There is no theme switcher. Surfaces are cool, low-chroma neutrals. The one accent is the existing carnival red, calmed to a lower chroma and tuned to pass 4.5:1 as text in both themes. `secondary`, `accent` and `neutral` are aliased to neutrals, so a leftover class cannot bring back a second hue. Status colors are desaturated and appear only inside status messages.
- Define the design system as tokens in `src/app.css` only. The tokens cover one self-hosted typeface with tabular numerals where numbers change or align, a fixed type scale of six sizes, the Tailwind 4 px spacing grid with no arbitrary values, three radii, hairline borders instead of shadows, one global focus ring, and a motion policy that honors `prefers-reduced-motion`.
- Raise interaction feedback on the flows that already exist: suggestions show a pending state instead of an empty dropdown while they load, the empty search result is a quiet neutral empty state instead of a yellow warning, and the initial data load, pagination while data loads, the share confirmation and the form submit each have one consistent pending or confirmation style. Every control gets a visible keyboard focus ring and a tap target of at least 24 by 24 px, with the primary targets (search field, submit button, pagination) at least 40 px tall at 360 px wide.
- Restyle every surface on those tokens: the header and mobile drawer, the search field and suggestions, the letter navigation, the word card, the home states (browse, search results, word detail, empty, load failure), pagination, `/add` with its validation, success and error states, `/guidelines`, and the footer.
- Fix accessibility defects that contradict the system: one `h1` per page (the brand in the header stops being a heading), `lang="es"` on the document, pinch zoom enabled, and `theme-color` following the active scheme.
- Honest copy: remove the decorative emoji from `/guidelines` and fix the typos "Desarollado" and `rel="noreferer"`. Every other string stays unchanged.
- Delete the unused `WordCardSkeleton.svelte`. It has no importer since commit d4394a7.
- Tighten `scripts/ui-audit.js` so that `--strict` enforces the spec: allowed font sizes, allowed radii, a visible focus ring, status hues only inside status regions, and minimum primary target heights. Add `--strict` to `bun run ci`, and add a banned-class check to `bun run lint`.
- Add one or two static WebP screenshots of the new UI to the README, captured by a script from the built app. The procedure is documented so that the next visual change can refresh them the same way.
- No new routes, no new controls, no new data, no change to search, pagination, sharing or submission behavior. **BREAKING** is visual only: returning visitors see a different look.

### Iteration 2 (user feedback, 2026-09-30)

The first iteration restyled the pages but kept their structure, and the user found that the letter sidebar on every page does not feel minimal and that the search and welcome experience is what the revamp is about. Production also cannot accept web submissions: its `/_app/env.js` is `{}`, so `/add` always ends in "El webhook no está configurado". This iteration therefore changes behavior on purpose, and the design-system spec's "Scope of behavior changes" requirement lists exactly what: `/add` is removed, the welcome screen is search first, letters browse by first letter instead of running a text search for the letter, the search field is a keyboard combobox, and the sidebar and mobile drawer are gone.

## Capabilities

### New Capabilities

- `design-system`: the single visual language every page uses (palette and themes, one accent, contrast floor, typography, shape and depth, spacing, motion, focus and target size, interaction feedback, honest copy) and the guarantee that restyling changes no behavior.
- `project-media`: the README screenshots, what they show, their size limits, and the scripted procedure that produces them.

### Modified Capabilities

None. `openspec/specs/` is empty.

## Impact

- **Code**: `src/app.css` (tokens, themes, font face, focus rule), `src/app.html` (`lang`, viewport, `theme-color`), `static/manifest.json` (`theme_color`, `background_color`), every `.svelte` file under `src/routes/` and `src/lib/components/`, and deletion of `src/lib/components/WordCardSkeleton.svelte`.
- **Assets**: a self-hosted variable font in `static/fonts/` (Latin subset, `woff2`, about 50 to 100 KB), and one or two README screenshots under `docs/media/` (at most 200 KB each).
- **Tooling**: `scripts/ui-audit.js` (stricter `DESIGN` rules), a new `scripts/capture-media.js` (it reuses Playwright, which is already a dev dependency), `package.json` scripts (`ci` runs the audit with `--strict`, `lint` gains the banned-class check, a new `media` script), `docs/MEDIA.md`, and the `AGENTS.md` sections on verification and media.
- **Dependencies**: none added. The lockfile is untouched. The font is a committed static file, not a package.
- **Tests**: the unit and component tests guard behavior and must stay green without changes to what they assert. The audit's hard checks guard the flows, and `--strict` guards the visual rules.
- **Hosting**: none. The site is static on Cloudflare Pages, and the font is one more precached static file for the service worker.
