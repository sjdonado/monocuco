# README screenshot

The README shows one screenshot of the app: `docs/media/home-dark.webp`, the home page with nothing searched, on a desktop, in the dark theme.

## When to regenerate

Regenerate the image in the same change whenever that change alters how the home page, the header, the search field, the word card, the letter row or the pagination look, or changes a design token in `src/app.css`. The README must never show an older design.

## How

1. Serve the production build: `bun run build && bun run preview`.
2. With the browser MCP's `run` (Playwright), open a context with a 1024 by 720 viewport, the dark color scheme, a device pixel ratio of 2, reduced motion and every request outside the preview server blocked. Open `/`, wait until the twelve words and the letter row show and `document.fonts.ready` resolves, then move the pointer to the corner and remove focus, so no caret, focus ring or hover state is in the picture.
3. Take a screenshot of the viewport as PNG.
4. Convert it: `cwebp -q 80 -resize 1600 0 home.png -o docs/media/home-dark.webp` (macOS: `brew install webp`).

## Checks on the result

- The file is a static WebP, 1600 px wide, of at most 200 KB.
- Open the README preview and confirm that the entry text is readable at the rendered width without zooming.
- Capture it a second time and confirm with `git status` that the image did not change, or changed only in encoding bytes: the words shown and the framing must be identical.
- Commit the image with the visual change that required it.
