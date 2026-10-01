# Design System Specification

## Purpose

Gives every page of Monocuco one calm, precise, minimal visual language in a light and a dark variant, and one standard of interaction feedback, defined once as tokens and reused, so the dictionary reads as one coherent reference work without any change in what it does.

## Requirements

### Requirement: Light and dark themes from one token set

The site SHALL render every page with one of two themes, light and dark, built on the same token structure. Colors, radii, border width and font family SHALL be defined once per theme as design tokens, and every page SHALL consume them. The theme SHALL follow the operating system's color scheme. The site SHALL NOT offer a theme control. The browser's `theme-color` SHALL match the surface of the active theme. The web manifest, which cannot follow the color scheme, SHALL use the light theme's surface color.

#### Scenario: OS preference decides the theme

- **WHEN** a visitor whose operating system prefers light opens any page
- **THEN** the page renders in the light theme, and in the dark theme when the operating system prefers dark

#### Scenario: Every page uses the shared theme

- **WHEN** any route or state is rendered (all words, page 2, a letter, search results, empty search, a word, search data failure, not found, `/guidelines`)
- **THEN** its background, text, borders and controls use the colors of the active theme, and no element sets a color outside the token set

### Requirement: One accent color

The palette SHALL contain exactly one brand accent, a red in the hue family of the existing carnival red, at a lower chroma than the current `oklch(57% 0.245 27)`. The accent SHALL be used only for interactive emphasis: the one primary action, links and controls on hover and focus, the focus ring, and the initial loading bar. At rest, at most one element per screen SHALL carry the accent, the page's primary action. Headings, resting links, the current page in pagination, the matched search term and section markers SHALL be neutral, marked by weight or a tonal fill instead. Status colors (success, warning, error, info) SHALL be desaturated and SHALL appear only inside a status message (an element with `role="status"` or `role="alert"`) or on the field and message of a form validation error.

#### Scenario: No second hue on a screen

- **WHEN** any page or state is rendered and every visible color is measured
- **THEN** at most one chromatic hue family appears outside status messages, and it is the accent

#### Scenario: Guidelines headings are neutral

- **WHEN** a visitor opens `/guidelines`
- **THEN** the section headings use the primary text color, not a success or error color

#### Scenario: Empty search is not a warning

- **WHEN** a search returns no results
- **THEN** the page shows a neutral empty state with the existing message, without a warning color

### Requirement: Contrast floor

Body and secondary text SHALL meet a WCAG 2.2 contrast ratio of at least 4.5:1 against the background behind it, in both themes. Text at 24 px or larger, or at 18.66 px or larger and bold, SHALL meet at least 3:1. The focus indicator and the boundaries of inputs SHALL meet at least 3:1 against the adjacent surface. Secondary text SHALL use one token, not ad hoc opacities.

#### Scenario: Measured contrast on every page

- **WHEN** the browser audit measures every visible text element on every page and state at 360 px and 1440 px in both themes
- **THEN** no element falls below its contrast floor

#### Scenario: Accent links in the dark theme

- **WHEN** an accent-colored link or the current page number is rendered on the dark surface
- **THEN** its measured contrast is at least 4.5:1

### Requirement: Typography

The site SHALL use one typeface family, served from the site's own origin, and SHALL NOT request fonts from any other origin. It SHALL use a fixed type scale of exactly these six sizes: 12, 14, 16, 18, 24 and 30 px. Hierarchy SHALL come from size and weight (400, 500, 600), never from color. Numbers that change or align (letter counts, result counts, pagination numbers, the app version) SHALL use tabular numerals. Running text SHALL NOT use tabular numerals. Text inputs SHALL render at 16 px or larger on narrow screens, so that focusing them does not zoom the page on iOS.

#### Scenario: Only scale sizes are used

- **WHEN** the browser audit collects the font size of every visible text element on every page and state
- **THEN** every size is one of 12, 14, 16, 18, 24 or 30 px

#### Scenario: No third-party font request

- **WHEN** a visitor loads any page
- **THEN** no request is made to a font host other than the site's own origin

#### Scenario: Counts do not shift

- **WHEN** the result count or the page number changes
- **THEN** the digits keep equal widths, so the surrounding text does not move horizontally

### Requirement: Shape, depth and spacing

Surfaces SHALL be separated by spacing, hairline borders and one tonal step, never by drop shadows. Corner radii SHALL come from the token set, which has exactly three values: a field radius, a box radius and a full pill radius. Gradients, glass effects and noise SHALL NOT be used. Spacing and sizing SHALL use the 4 px grid, with no arbitrary pixel or viewport values in class names.

#### Scenario: Cards and dropdowns have no shadow

- **WHEN** the suggestions dropdown or a status panel is rendered
- **THEN** it is bounded by a hairline border in the shared border color and its computed `box-shadow` is `none` or fully transparent

#### Scenario: One entry style everywhere

- **WHEN** all words, a page, a letter, a search or a single word is shown
- **THEN** every entry has the same style, a row separated from the next by a hairline divider and never a boxed card. The first entry follows the result line directly.

#### Scenario: Only token radii

- **WHEN** the browser audit collects the border radius of every visible element
- **THEN** every non-zero radius is one of the three token values

### Requirement: Motion policy

Animation SHALL be limited to functional feedback: color transitions on hover and focus of at most 150 ms, the loading indicators, and the opening of the drawer and the suggestions. When the visitor prefers reduced motion, the site SHALL replace movement with an instant state change, and the resulting state SHALL be the same.

#### Scenario: Reduced motion

- **WHEN** a visitor with `prefers-reduced-motion: reduce` opens the mobile drawer, or waits for suggestions or the initial data load
- **THEN** no element moves or spins, and the same content and state indicators appear

### Requirement: Focus and target size

Every link, button, input and option SHALL show a visible focus indicator when it is focused by keyboard. The indicator SHALL be the same accent ring everywhere, drawn once per control. Every interactive target SHALL be at least 24 by 24 px, except a link inside a sentence of running text. At 360 px wide, the search field and the previous and next pagination buttons SHALL be at least 40 px tall. Buttons in one group SHALL share one height at every width.

#### Scenario: Keyboard focus is visible

- **WHEN** a keyboard user tabs through every focusable element on the home page, a search result page and `/guidelines`
- **THEN** each focused element shows an outline or ring with at least 3:1 contrast against the surface around it

#### Scenario: Field boundaries and placeholders

- **WHEN** an enabled text field is rendered in either theme
- **THEN** its border has at least 3:1 contrast against the surface around it, and its placeholder text has at least 4.5:1 against the field

#### Scenario: Targets meet the minimum

- **WHEN** the browser audit measures every interactive element on every page and state at 360 px and 1440 px
- **THEN** none is smaller than 24 by 24 px, except links inside running text, and the letters and page numbers are at least 32 px square

### Requirement: One layout on every page

Every page SHALL use the same layout from the first load: a sticky header with the logo linking home and the search field, then one content column. Every state is a search: all words is the empty query, a letter or a single word is a narrower one. Each SHALL start with the same left-aligned result line in the same place: "2767 palabras encontradas", "255 palabras encontradas con M", "8 palabras encontradas para "carnaval"", "1 palabra encontrada para "Ira"", and "N palabras parecidas a "x"" when the results are approximate. Browse pages (all words, a later page, a letter) SHALL show the letter row below the result line. There SHALL be no separate welcome layout, sidebar or menu. The footer SHALL hold the one-line description with its link, the version, the link to `/guidelines`, the source code link and the author link.

#### Scenario: First visit

- **WHEN** a visitor opens `/` for the first time
- **THEN** the header with the search field is at the top, as on every other page, followed by "2767 palabras encontradas", the letter row and the word list

#### Scenario: The result line is always in the same place

- **WHEN** a visitor moves between all words, a letter, a search and a single word
- **THEN** the result line is the first line of the content, left-aligned, in the same size and position on each

### Requirement: Pages stay findable and understandable

Less visible text SHALL NOT make a page harder to understand for assistive technology or search engines. Every page SHALL have a title that names it ("Monocuco | Diccionario de español barranquillero", "Monocuco | Buscar "x"", "Monocuco | Palabras por letra: M", "Monocuco | <word>"), exactly one meta description that describes the site, absolute Open Graph URLs on the live domain, and exactly one `h1` that describes the page: visually hidden on lists, where the result line and the entries carry the meaning, and the headword itself on a word's page.

#### Scenario: Lighthouse

- **WHEN** Lighthouse audits `/`, a search, a letter, a word and `/guidelines`
- **THEN** accessibility and SEO both score 100

#### Scenario: A word's page

- **WHEN** a visitor or a crawler opens a word's link
- **THEN** the tab title is "Monocuco | <word>" and the page's `h1` is the headword

### Requirement: Search as a keyboard combobox

The search field SHALL behave as a combobox whose list starts with the option `Buscar "<typed text>"`, followed by up to five suggestions, each with the word and one line of its definition. The first option SHALL do exactly what Enter does with nothing highlighted: search for the typed text (and, like that search, move focus to the results). It is always there while the field has text, so a term with no suggestion is never a dead end; there is no "Sin resultados" row. Down and Up SHALL move the highlight through the options in order (none, `Buscar`, then each suggestion, wrapping around), Enter SHALL run the highlighted option, and Escape SHALL close the list. The highlighted option SHALL be exposed to assistive technology (`aria-activedescendant`); choosing a suggestion with the mouse or Enter SHALL keep focus in the field, also after the word opens; closing the list SHALL forget the highlight. While suggestions are loading the list SHALL show "Buscando..." below the first option, and a failed lookup SHALL say "Búsqueda no disponible por ahora.".

#### Scenario: Choose a suggestion with the keyboard

- **WHEN** a visitor types a word, presses Down twice and then Enter
- **THEN** Down first highlights `Buscar "<word>"`, then the first suggestion, which is announced, and Enter opens that word's page

#### Scenario: A term with no suggestion

- **WHEN** a visitor types a term no word matches
- **THEN** the list shows only `Buscar "<term>"`, never "Sin resultados", and choosing it opens the results page for that term, the same page Enter opens

#### Scenario: Search the typed text

- **WHEN** a visitor types "carnaval" and presses Enter without highlighting a suggestion
- **THEN** the results page for "carnaval" opens, with the result line "8 palabras encontradas para "carnaval""

### Requirement: Search results that make sense

A search SHALL require every word of the query to match (as a word or a word prefix), treating accented and unaccented letters as the same letter except ñ. Only when nothing matches SHALL it fall back to typo-tolerant matching, and then the count line SHALL say the results are approximate. The full word list SHALL be in Spanish dictionary order, the same order the letter row uses: leading punctuation ignored, accented initials with their letter, Ñ after N. Submitting an empty search field SHALL return to all words.

#### Scenario: Accents do not split results

- **WHEN** a visitor searches "aja" and then "ajá"
- **THEN** both show the same entries, including "Aja" and "Ajá"

#### Scenario: Every word counts

- **WHEN** a visitor searches "a vaina"
- **THEN** the results are the entries matching both words, with "¡A vaina!" among them, not every entry containing "a"

#### Scenario: A typo is labeled

- **WHEN** a visitor searches a term with no exact or prefix match, such as "peloa"
- **THEN** the result line reads "N palabras parecidas a "peloa""

#### Scenario: Clearing the field

- **WHEN** a visitor empties the search field on a results page and presses Enter
- **THEN** all words (`/`) opens; on a letter or a later page, where nothing was searched, an empty submit does nothing

### Requirement: Browse by letter

Each letter in the letter row SHALL open the words filed under that letter, in dictionary order, paginated like the full list, at `/?letter=<letter>`. A word SHALL be filed under its first letter after any leading punctuation, without accents, keeping Ñ as its own letter after N. The row SHALL start with "Todas" (all words). The letter being browsed, or "Todas" when none is, SHALL be marked as current, and the page SHALL state how many words it has. Each letter link's accessible name SHALL include its word count. The row SHALL render at its final size before the search data loads, from counts computed when the data is built. A letter in the URL SHALL be filed by the same rule, so `?letter=é` browses E.

#### Scenario: Browse M

- **WHEN** a visitor chooses "M" in the letter row
- **THEN** the page lists only words filed under M, states "N palabras encontradas con M" with the same N the letter's name announces, and pages through them with Anterior and Siguiente

#### Scenario: Punctuation and accents

- **WHEN** the letter row is built from the dictionary
- **THEN** "¡A vaina!" is under A, a word starting with "É" is under E, and the row contains only the letters A to Z and Ñ, in Spanish order

### Requirement: Interaction feedback on existing flows

Every flow SHALL give immediate, legible feedback in the one shared style: waiting for suggestions, the first load of the search data, a search, letter, page or word opened before the data is ready, pagination while the data loads, copying a share link, and a failed data load. Pending states SHALL be a small inline indicator; they SHALL NOT be a blank area or the wrong content.

#### Scenario: Opening a search before the data is ready

- **WHEN** a visitor opens `/?q=carnaval` or `/?letter=M` and the search data has not loaded yet
- **THEN** the result line reads "Buscando "carnaval"" (or "Buscando palabras con M") with a spinner instead of the prerendered first page, and then the results

#### Scenario: Pagination before the data is ready

- **WHEN** all words (`/`) is shown from the prerendered page before the search data has loaded
- **THEN** the pagination shows "Página 1 de N" with the previous and next buttons visibly disabled, and it becomes the numbered pagination once the data is ready, without the layout jumping

#### Scenario: Share confirmation

- **WHEN** a visitor copies a word's link on a browser without the Web Share API
- **THEN** "Enlace copiado" appears next to the share button in the status style and is announced to assistive technology

### Requirement: One heading structure per page

Each page SHALL have exactly one `h1` (see "Pages stay findable and understandable"). The logo link in the header SHALL NOT be a heading. The document language SHALL be Spanish. The viewport SHALL allow pinch zoom.

#### Scenario: Single h1

- **WHEN** any page or state is rendered
- **THEN** the document contains exactly one `h1`

#### Scenario: Zoom is allowed

- **WHEN** a visitor pinches to zoom on a phone
- **THEN** the page zooms, because the viewport does not set `user-scalable=no` or `maximum-scale=1`

### Requirement: Honest copy without decorative emoji

Interface copy SHALL NOT contain decorative emoji. Copy SHALL stay in Spanish, in sentence case, and SHALL make no claim the product cannot back: in particular the site SHALL NOT offer a way to submit words that production cannot deliver. Displayed numbers SHALL be exact counts, without timings.

#### Scenario: Guidelines without emoji

- **WHEN** a visitor opens `/guidelines`
- **THEN** the section headings read "Lo que esperamos de tus aportes" and "Lo que no aceptamos", with no emoji

#### Scenario: Result count reads correctly

- **WHEN** a search returns 0, 1 or 8 results
- **THEN** the result line reads "0 palabras encontradas para", "1 palabra encontrada para" or "8 palabras encontradas para", followed by the search term

#### Scenario: Footer spelling

- **WHEN** any page is rendered
- **THEN** the footer reads "Desarrollado por"

### Requirement: Scope of behavior changes

The redesign SHALL change behavior only where this spec says so: the `/add` page and every link to it are removed, because production has no submission webhook, and contributing is described only in the README; letters browse by first letter; the search field is a keyboard combobox; the mobile drawer and the letter sidebar are removed. Search ranking, pagination, sharing, word detail URLs and offline behavior SHALL work as before. The site loads no analytics (removed after the redesign; `/privacy` states that it collects no data).

#### Scenario: Removed submission

- **WHEN** a visitor opens `/add` after the change, for example from an old bookmark
- **THEN** no submission form exists, no page links to `/add`, and the visitor sees the site's own "Página no encontrada" page in the shared style, saying that words are no longer received on the web with a link to how to propose one on `/guidelines`, and "Volver al inicio" leading to all words (`/`)

#### Scenario: Back and forward

- **WHEN** a visitor searches from all words (`/`), or pages from page 1 to page 2 and back
- **THEN** the browser's Back button, and Anterior on page 2, return to all words (`/`)

#### Scenario: Paging is history

- **WHEN** a visitor pages forward through results, a letter or all words
- **THEN** each page is a history entry, so Back returns to the previous page, and keyboard focus stays in the pager: on the control that was used, or on the current page number when that control becomes disabled (first or last page)

#### Scenario: Recovering from a failed load

- **WHEN** the search data fails to load
- **THEN** the page says so with a "Reintentar" button that reloads it, all words (`/`) still shows its prerendered first page, and there is exactly one search field

#### Scenario: A word that does not exist

- **WHEN** a visitor opens `/?word=<unknown id>`
- **THEN** the page says "No encontramos la palabra solicitada." with a link "Ver todas las palabras", shows no pager, and the tab title reads "Monocuco | Palabra no encontrada"

#### Scenario: Flows still work

- **WHEN** the audit's flows (search submit, suggestion select with mouse and keyboard, letter browse, pagination next) and the unit and component tests run after the change
- **THEN** they pass
