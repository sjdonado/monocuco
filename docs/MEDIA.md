# README screenshots

The README shows one screenshot of the app: `docs/media/home-dark.webp`, the home page with nothing searched, on a desktop (1024 by 720), in the dark theme. It is generated from the production build, never captured by hand, so any change can refresh it the same way.

## When to regenerate

Regenerate the image in the same change whenever that change alters how the home page, the header, the search field, the word card, the letter row or the pagination look, or changes a design token in `src/app.css`. The README must never show an older design.

## How

1. Install `cwebp` once (macOS: `brew install webp`). Playwright's Chromium comes from `bunx playwright install chromium`.
2. Stop any server on port 4179 (the audit and this script share it).
3. Run `bun run media`. It builds the app, serves it with `vite preview`, opens each state with third-party requests blocked and reduced motion on, waits until the client shows the state (the home page's word list and letter row, or the single word), removes focus and hover, and captures at device pixel ratio 2. Then it converts each capture with `cwebp -q 80` to 1600 px wide.
4. The script fails when `cwebp` is missing, when a state never appears, or when the image is over 200 KB.

The shot, its viewport, scheme and state are the `SHOTS` table in `scripts/capture-media.ts`. Change them there, not by hand.

## Checks on the result

- Each file is a static WebP of at most 200 KB (the script enforces this).
- Open the README preview on GitHub or in an editor and confirm that the entry text is readable at the rendered width without zooming.
- Run `bun run media` a second time and confirm with `git status` that the image did not change, or changed only in encoding bytes: the words shown and the framing must be identical.
- Commit the image with the visual change that required it.
