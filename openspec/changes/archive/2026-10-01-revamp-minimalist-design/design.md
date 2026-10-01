## Context

See proposal.md, Why. The facts that shape the approach:

- All theming flows through the two `@plugin "daisyui/theme"` blocks in `src/app.css`. `--depth` and `--noise` are already 0. Components use DaisyUI classes (`btn`, `card`, `input`, `alert`, `drawer`, `dropdown`, `progress`, `link`, `prose`) and Tailwind utilities directly, across 8 `.svelte` files. A token change therefore restyles most of the app at once, and the remaining work is removing per-component overrides. The current counts are 7 `shadow-*`, 5 `text-3xl`, 7 `font-bold`, 17 `text-base-content/NN` with five different opacities, 2 `dark:border-gray-700`, 2 `text-success`/`text-error` headings, 1 `alert-warning` for the empty search, and 2 `rounded-*`.
- The built CSS puts DaisyUI in its own `@layer daisyui.*` layers next to Tailwind's `theme`, `base`, `components` and `utilities` (AGENTS.md, Traps). A shared rule of ours can lose to a component class depending on layer order.
- The font is the system stack (`ui-sans-serif`), and no third-party font request exists today.
- `src/app.html` sets `lang="en"`, disables zoom (`maximum-scale=1.0, user-scalable=no`) and hardcodes `theme-color` `#e20f21`. `static/manifest.json` has its own colors.
- The layout's brand is an `h1`, and every page has its own `h1` too.
- `scripts/ui-audit.js` already measures contrast, tap size, shadows, hue families and third-party fonts, and it records radii, font sizes and families in its report. `--strict` turns its design issues into failures. Its thresholds live in one `DESIGN` object.
- The repository has no marketing media. The README has no screenshots, and `og:image` is the logo. `cwebp` and `magick` are installed on the maintainer's machine, and Playwright is a dev dependency.
- The site is static with `ssr = false`. Only `/`, `/add` and `/guidelines` are prerendered. The service worker precaches `build` and `static` files, so a new static font file is cached offline automatically.

## Goals / Non-Goals

**Goals:**

- One token set, so a later design change edits one file.
- Every rule in the design-system spec is enforced by a machine check (`bun run lint` for source patterns, `bun run audit:ui -- --strict` for rendered pages), so "done" is not a judgement call and cannot regress silently.
- Every state is restyled, including the rarely seen ones: search data failure, `/add` success and error, disabled pagination, and the drawer.

**Non-Goals:**

- A theme switcher, or any control that does not exist today.
- New components for their own sake. DaisyUI stays the component layer.
- Keyboard navigation of the suggestion list. It would be new behavior. It is recorded as a follow-up, not done here.
- Copy rewrites beyond removing emoji and fixing spelling.
- A pixel-diff visual regression suite. The audit measures rules instead of comparing images.
- Changing the logo image, the favicon or `og:image`.

## Decisions

### 1. Palette: Nordic neutrals, calmed carnival red

Surfaces are cool, very low-chroma neutrals (hue about 250, chroma at or below 0.012). The single accent keeps the carnival red hue (about 25) at roughly two thirds of today's chroma. The accent is darker in light mode and lighter in dark mode, so that it passes 4.5:1 as text on both. Slice 1 measured these final values: the accent is 5.85:1 (light) and 6.89:1 (dark) on the page, text on the accent is 5.80:1 and 7.19:1, and muted text is 5.87:1 and 6.32:1 on the page and at least 5.48:1 on `base-200`. The border token is `--color-hairline`, `base-content` at 12 % alpha.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `base-100` | `oklch(99.2% 0.002 250)` | `oklch(20% 0.008 250)` | page, cards, inputs, dropdown |
| `base-200` | `oklch(97% 0.004 250)` | `oklch(23% 0.009 250)` | one tonal step: hover rows, disabled fills, the drawer |
| `base-300` | `oklch(92% 0.006 250)` | `oklch(30% 0.01 250)` | hairline borders when a solid color is needed |
| `base-content` | `oklch(23% 0.01 250)` | `oklch(94% 0.005 250)` | primary text |
| secondary text (`--color-muted`) | `oklch(50% 0.012 250)` | `oklch(68% 0.01 250)` | the one secondary-text token, replacing `/50` to `/80` |
| `primary` | `oklch(52% 0.16 25)` | `oklch(72% 0.13 22)` | the accent |
| `primary-content` | `oklch(99% 0.003 25)` | `oklch(18% 0.03 25)` | text on the accent |
| `secondary`, `accent`, `neutral` | aliased to neutral values | aliased to neutral values | a leftover class degrades to neutral, never to a second hue |
| status colors | chroma at or below 0.09 | chroma at or below 0.09 | success, warning, error, info |

`theme-color` becomes two `<meta name="theme-color">` tags with `media="(prefers-color-scheme: ...)"`, set to `base-100` of each theme. The manifest's `theme_color` and `background_color` use the light `base-100`, because a manifest cannot follow the color scheme.

Alternatives: the frost blue accent that Nordic palettes usually use (rejected: the user chose to keep the red for brand continuity with the logo); keeping today's full-chroma red (rejected by the user, and it is the source of the 4.03:1 dark links). Flip condition: after slice 1, the user finds the calmed red too dull next to the logo.

### 2. Typeface: Inter, self-hosted

Inter variable, Latin subset, `woff2`, weight axis 400 to 600, placed in `static/fonts/` with its OFL license file, declared once with `@font-face` and `font-display: swap`, and preloaded from `src/app.html`. The Latin subset covers Spanish (á, é, í, ó, ú, ü, ñ, ¡, ¿). Inter has true tabular figures for the counts and page numbers, and its neutral forms fit a reference work. The stack falls back to `ui-sans-serif, system-ui`.

Type scale: exactly `text-xs` (12), `text-sm` (14), `text-base` (16), `text-lg` (18), `text-2xl` (24) and `text-3xl` (30). `text-xl` and `text-4xl` and above are banned. Page titles use `text-2xl font-semibold`. The word card headword is `text-2xl` on phones and `text-3xl` from `sm` up, because in a dictionary the headword is the product. Weights are 400, 500 and 600. `font-bold` is banned, and in rendered Markdown `strong` maps to 600. Hierarchy never comes from color.

Alternatives: the system stack (zero bytes, but a different face per OS undoes "one visual language"); a serif for the headwords, the classic dictionary look (more character, but a second family, and it doubles the font weight). Flip condition: the user wants a serif headword after slice 1.

### 3. Shape, depth, spacing

Three radii: `--radius-field: 0.375rem` (inputs, buttons), `--radius-box: 0.5rem` (cards, dropdown, drawer panel, alerts) and `--radius-selector: 9999px` (pills, if any). Every `shadow-*` is removed. Separation comes from a 1 px border in `base-content` at 12 % alpha, from spacing, and from the one tonal step to `base-200`. `min-h-[89vh]` on `main` is replaced by a flex column layout that pushes the footer down (`min-h-dvh` on the root), which removes the only arbitrary value.

Alternative: keep cards as filled tiles without borders (rejected: on the light surface they lose their edges without a shadow). Flip condition: none expected.

### 4. Where tokens live, and the focus rule

`src/app.css` stays the single file. It holds the DaisyUI theme blocks for colors, radii and border, `@theme` for the font family and type scale, `@font-face`, and a few shared rules. Shared rules are defined with `@utility`, not `@layer components`, so they sit at utility level and beat DaisyUI component classes (see Context). There are three shared rules (`prose-tokens` also maps the typography plugin's colors to the tokens):

- `text-muted`: the secondary-text token.
- `border-hairline`: the 1 px border in the shared border color.
- One global `:focus-visible` rule: a 2 px accent outline with 2 px offset, excluding `[aria-invalid="true"]`, which keeps its error ring. It is written as unlayered CSS rather than a utility, because unlayered rules win over every cascade layer. Slice 1 measured that it wins over DaisyUI's focus styles in both themes.

Tabular numerals are applied with `tabular-nums` only on the elements that show counts, page numbers and the version, never globally, because global tabular numerals also space out punctuation.

Alternative: a separate `tokens.css` (rejected: two places to look, and Tailwind 4 already treats `app.css` as the theme entry). Flip condition: `app.css` grows past about 200 lines.

### 5. Status colors and the audit's hue rule

Status colors are allowed only inside `[role="status"]`, `[role="alert"]` and form validation. Form validation means the invalid field (`aria-invalid="true"`) and the message the field references with `aria-describedby`. The form fields gain `aria-invalid` and `aria-describedby`. These attributes are accessibility semantics for errors the form already shows; they add no behavior. The audit's hue count excludes exactly those elements. The empty search result becomes a neutral empty state with `role="status"`, and the `/guidelines` headings become neutral.

Alternative: count status hues and allow a maximum of two families (rejected: it would allow a decorative second hue on any page). Flip condition: a status message that must show on a page without a role, which does not exist today.

### 5b. Design critique folded in (task 4.5)

A read-only design critique of home found five problems; the accepted changes, decided without a user checkpoint at the user's instruction ("do all phases, verify by yourself"):

- Entries are hairline-divided rows everywhere, including the single-word view (user feedback in iteration 2: a boxed card only on word detail broke consistency). Twelve boxes read as a feed, not a reference work.
- The share control is icon-only at every width (accessible name unchanged), muted, aligned optically to the text edge.
- The shell narrows from `max-w-6xl` to `max-w-5xl`, so the `max-w-2xl` text column, the pagination and the `16rem` sidebar share one grid.
- One resting accent per screen: the matched term and the current page become neutral (weight, `bg-base-200`); the header's "Agregar palabra" stays the one primary button.
- The query and the result count share one line; on word detail the page title is visually hidden (still the `h1`) and the line is hidden, so the headword leads.
- Markdown margins are reset inside entries (`prose-p:my-0`), the author and date are separated by the footer's existing "•", the letters sit in two columns, and every pagination button has one height (40 px on phones, 32 px from `sm`).

Rejected: replacing "Bienvenido" with the intro sentence and moving "Código fuente disponible en Github" to the footer (both change or move existing copy, which is outside a restyle); a secondary style for the header CTA (it would leave no resting primary action).

### 6. Interaction feedback, using what exists

- **Suggestions**: while `loading` is true, the open dropdown shows one inert row (`role="option"`, `aria-disabled`) with a small spinner and the text "Buscando..." instead of an empty panel; under reduced motion the spinner is hidden. "Sin resultados" appears only when loading has finished. The dropdown keeps its behavior. "Buscando..." is the one new string, kept because an unlabeled spinner inside a listbox announces nothing.
- **Initial load**: the top `progress` bar stays (it already waits 200 ms before it shows), restyled to a 2 px accent line, and under reduced motion it is a static line.
- **Pagination**: it keeps its two modes. The disabled "Página 1 de N" and the numbered mode reserve the same height, so switching modes does not shift the layout. The current page uses the accent with `aria-current`. Number targets become at least 32 px square.
- **Share**: "Enlace copiado" stays in its existing `aria-live` region, restyled as muted text with a check icon instead of a green color.
- **Submit**: the existing `Loader2Icon` spinner and "Enviando..." stay. Under reduced motion the spinner does not spin. The success and error messages get `role="status"` and `role="alert"`.
- **Search data failure**: the existing section is restyled as a bordered panel with an icon in the error color and neutral text.

Everything above restyles or annotates existing states. No new message copy is added except "Buscando..." for the reduced-motion case. Flip condition: if "Buscando..." counts as new copy for the user, use the spinner with an accessible label only.

### 7. Accessibility fixes inside the redesign

The header brand becomes a link that contains the logo and a `span`. `lang="es"`. The viewport becomes `width=device-width, initial-scale=1`, which enables pinch zoom. Inputs use `text-base` below `sm`, so enabling zoom does not bring back the focus zoom on iOS. These are included because the spec's measurable rules (one `h1`, contrast, target size) cannot pass without them, and none adds functionality. The same holds for the mobile drawer: its open and close controls become real buttons, the invisible checkbox leaves the tab order, the page behind an open drawer is `inert`, focus moves into the panel once it is visible, and Escape closes it. The browser pass found that keyboard focus otherwise walks behind the open panel. Fields get a dedicated `--color-field-border` token (3:1) and placeholders use the secondary-text token, because the hairline (about 1.3:1) is too faint for a control boundary (WCAG 1.4.11).

Alternative: leave zoom disabled to keep the app-like feel (rejected: it fails WCAG 1.4.4, and the brief asks for first-class accessibility). Flip condition: the user explicitly wants zoom disabled.

### 8. Enforcement: lint for source, audit for pixels

- `scripts/design-lint.js`, a Node script with no dependencies, runs from `bun run lint`. It greps `src/**/*.svelte` and `src/app.css` for banned patterns and fails with `path:line`. The banned patterns are `shadow-`; `rounded-(sm|md|lg|xl|2xl|3xl)`; `text-(xl|4xl|5xl|6xl|7xl|8xl|9xl)`; `font-(bold|extrabold|black)`; `text-base-content/`; `(text|bg|border|btn|badge|link)-(secondary|accent|neutral)`; `alert-(warning|info|success)`; `dark:`; `(gray|slate|zinc|neutral|stone)-[0-9]`; arbitrary values `\[[0-9.]+(px|rem|vh|vw|%)\]`; `skeleton`; and decorative emoji (Unicode `Extended_Pictographic`).
- `scripts/ui-audit.js` gains strict rules in `DESIGN`:
  - `allowedFontSizes: [12, 14, 16, 18, 24, 30]`.
  - `allowedRadii`: the three token values plus 0.
  - `primaryTargets`: minimum 40 px height at 360 px for the search box, the submit button, and Anterior and Siguiente.
  - A focus pass that tabs through home, `/add` and `/guidelines` and checks that each focused element has a non-zero outline or ring with at least 3:1 contrast.
  - A single-`h1` check.
  - The status exemption from decision 5.
- `bun run ci` runs the audit with `--strict` once slice 1 lands. From then on a design regression fails the ladder like a broken flow.

Alternative: Lighthouse accessibility as the gate (rejected as the gate: it is not a dependency, fetching it at run time is a network call, and it audits one scheme at one width). Lighthouse is still run once by hand on `/`, `/add` and `/guidelines` in both schemes as extra acceptance evidence, with a score of 100 expected. Flip condition: Lighthouse and the audit disagree on a contrast pair; then the audit's measurement is fixed.

### 9. README screenshots: scripted, committed, small

`scripts/capture-media.js` reuses the audit's preview server and page states. To share them without importing a script that runs on load, the preview start, the page table and the ready waits move to `scripts/lib/app-states.js`, and both scripts import that module. It captures two stills at device pixel ratio 2:

- `docs/media/home-light.webp`: the search results for "carnaval" at 1280 by 800 in the light theme.
- `docs/media/word-dark.webp`: a word detail at 390 by 844 in the dark theme.

The script pipes each PNG through `cwebp -q 80`, resizes it to 1600 px (desktop) or 780 px (phone) wide, and fails if an image exceeds 200 KB or if `cwebp` is missing. It is exposed as `bun run media`. The images are committed under `docs/media/` and referenced by relative path from the README. They are not app assets: no page shows them, so fingerprinting does not apply. `docs/MEDIA.md` documents when to run the script (any change to the header, search, word card or pagination), the command, and the checks on the result. AGENTS.md links to it.

Alternatives: a hand-captured procedure (rejected: not reproducible, and Playwright is already installed); an animated WebP (declined by the user, who chose stills). Flip condition: GitHub renders the stills blurry, in which case the density or width changes, not the method.

### 10. Order of work

1. **Tokens alone** (`app.css`, `app.html`, `manifest.json`, font). This is a human checkpoint: the user reacts to the direction before any page work.
2. **Enforcement and the class recipe**: stricter audit rules and `design-lint.js` in report mode, plus the class-level style recipe that every implementer follows.
3. **Pages in parallel, on disjoint file sets**:
   - (a) the shell: `+layout.svelte`, `SearchInput.svelte`, `LetterNav.svelte`;
   - (b) home: `+page.svelte`, `WordCard.svelte`;
   - (c) `/add` and `/guidelines`.
4. **Flip `ci` to `--strict`**, then the verification rounds and the designer critique of home.
5. **Media last**, because it depends on the finished UI.

## Superseded during implementation

The change ran as five iterations with the maintainer, and later ones replaced parts of the decisions above. The specs in this change describe what shipped; where this document disagrees with them, the specs win:

- No mobile drawer, letter sidebar or welcome hero. Every page has one layout: a sticky header with the search field, one `max-w-2xl` column, a left-aligned result line, the letter row on browse pages, and entries as rows (decisions 3, 5b and 7 mention the drawer, a `max-w-5xl` shell and a boxed single word).
- `/add` was removed, because production never had its webhook (decision 10 and the focus pages in decision 8 still list it); the audit's focus pages are home, a search and `/guidelines`.
- Search gained accent folding, AND matching with a labeled approximate fallback, and Spanish dictionary order, all from one module, `src/lib/text.js`.
- The README desktop shot is the home page at a 760 px viewport, resized to 1520 px (decision 9 says the search results at 1280 px and 1600 px).
- The audit grew state and flow checks beyond decision 8: the result line, one descriptive `h1`, titles and metadata, 32 px browse targets, a data-failure state in its own context, and 15 user flows.

## Risks / Trade-offs

- [DaisyUI's layer order beats our shared rules, so the focus ring or muted text silently loses] → Define the shared rules with `@utility`, and confirm the computed styles in the audit report during slice 1 before any page work.
- [Calmed red fails 4.5:1 on one surface] → The audit measures every text element in both themes. Slice 1 tunes lightness until the report is clean, before the palette is used anywhere else.
- [Inter adds about 50 to 100 KB on the first visit] → Latin subset, `woff2`, preloaded, precached by the service worker; the fallback stack avoids invisible text.
- [Enabling zoom changes the feel on phones] → Inputs at 16 px keep iOS from zooming on focus; the flip condition is in decision 7.
- [The audit's `--strict` produces false positives and blocks the ladder] → Each new rule is first run in report mode in step 2 and checked against the screenshots; a rule that misfires is fixed in the audit, never waived per page.
- [Parallel implementers produce three styles] → One class-level recipe, disjoint file sets, and a banned-pattern lint that fails on the patterns each one might reach for.
- [Screenshots in git grow the repository on each refresh] → Two files of at most 200 KB each, refreshed only on visual changes.

## Migration Plan

Nothing to migrate: the site is static. The change ships through a normal PR once the user approves publishing it, then `bun run deploy`. Rollback is redeploying the previous commit. The service worker's cache is keyed by build version, so the old assets are replaced on the next visit.
